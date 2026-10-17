# M00 — Repo bootstrap & tooling

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

Turn the empty GitHub repo `muhhammeddsayedd-prog/Everyone-Market-Researcher` into a working pnpm monorepo. When M00 is done:
- **Handoff pack in the repo:** it lives at the repo root (docs, milestones, data, reference, assets, templates, AGENTS.md, DESIGN.md, PROGRESS.md), so every later session reads the same files.
- **Skeleton app:** `apps/web` is a Next.js App Router app (TypeScript strict) that shows a placeholder page with the **everyone.** wordmark and "Market Radar".
- **Packages and folders:** `packages/shared` exists, with zod, test setup, and a place for DB types and normalizers. Empty-but-documented `supabase/`, `n8n/` and `scripts/` folders are in place.
- **Quality tooling:** lint, format, typecheck, unit tests (Vitest), an e2e skeleton (Playwright) and CI (GitHub Actions) all work. CI is green on `main`.
- **Repo hygiene:** Dependabot, `.gitignore` (including `.env*`), a PR template that requires a PROGRESS.md update, and branch protection on `main` (owner).
- **Vercel:** the project is linked (owner), and a preview deploy of the placeholder page works.

## 2. Context you need

- **Stack** (TECHNICAL §3, T-03, T-04): Next.js (latest stable, App Router, React Server Components) on Vercel; TypeScript strict; Tailwind CSS v4 + Radix primitives (shadcn/ui-style, restyled to DESIGN.md); zod; Vitest; Playwright; pnpm workspaces; Node 24 LTS.
- **Repo layout** (TECHNICAL §2):
  ```
  /AGENTS.md  /PROGRESS.md  /DESIGN.md  /README.md
  /docs/  /milestones/  /data/  /reference/  /assets/brand/  /templates/
  /apps/web/            Next.js app (UI, REST API, MCP — built from M09)
  /packages/shared/     zod schemas, generated DB types, taxonomy enums, normalizers
  /supabase/            config.toml, migrations/, tests/, seed.sql (from M01)
  /n8n/                 workflows/ (exported JSON), normalizers/ (plain-JS normalizers + Vitest), prompts/, README.md
  /scripts/             seed + resolve scripts (M02), eval (M07)
  ```
- **Brand assets:**
  - `assets/brand/everyone-logotype.svg` (paths use `currentColor`; render it white on black).
  - `assets/brand/everyone-wordmark-on-black.png` and `assets/brand/everyone-menu-dots.svg`.
  - `assets/brand/tokens.css` and `assets/brand/tokens.json`: the design tokens, written by the design pack. If they are missing, use black `#000`, white `#fff`, gray `#7d7f82` and accent green `#00cd6d`.
- **Fonts** (DESIGN_STYLE): General Sans (Fontshare, ITF Free Font License) and IBM Plex Sans Arabic are self-hosted from `apps/web/public/fonts/`, but they are added in **M09**, not in M00. The placeholder page uses the token font stack with a `system-ui` fallback.
- **Secrets** (hard rule 4): `.env*` is git-ignored, and only `templates/.env.example` (names, no values) is committed. Copy it to `apps/web/.env.example`.
- **Conventions** (AGENTS §6, TECHNICAL §16): Conventional Commits, branch `m00-bootstrap`, PR into `main`.

## 3. Prerequisites

| Item | Needed when | Notes |
|---|---|---|
| MA-01: repo push access + branch protection | Before T1 (push); protection after T7 (CI exists, so its check can be required) | The repo is empty |
| MA-02: Vercel project | T8 | Root directory `apps/web`, framework Next.js |
| Local tools | T1 | Node 24, pnpm (latest 10.x via corepack), git |

No earlier milestones.

## 4. Scope

**In:**
- Monorepo structure and workspace config.
- Next.js placeholder app.
- The shared package.
- Tooling: ESLint, Prettier, TypeScript project references or path aliases, Vitest, Playwright skeleton.
- CI workflow.
- Dependabot.
- PR template.
- README with dev instructions.
- Copying the handoff pack.
- Vercel preview.

**Out:**
- Supabase (M01).
- Auth, real pages and the design system build-out (M09).
- n8n (M03).
- Any secrets or env values.
- A DB test job in CI. It is added in M01, but leave a commented placeholder job.

## 5. References

- `docs/TECHNICAL.md` §2 (layout), §3 (stack), §15 (CI/CD), §16 (conventions).
- `docs/DEVELOPMENT_PLAN.md` §3 (working loop), §7 (definition of done).
- `docs/TESTING.md` §1 (layers and paths).
- `DESIGN.md`: tokens and app-shell basics (only the colours and fonts are needed for the placeholder).
- `templates/.env.example`, `templates/MILESTONE_PROGRESS_TEMPLATE.md`.

## 6. Deliverables

| Path | What |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `pnpm-lock.yaml` | Workspace root. Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `format:check` |
| `.nvmrc` (`24`), `engines` in root `package.json` | Node pin |
| `tsconfig.base.json` | Strict TS base (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` optional) |
| `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig` | Lint/format |
| `apps/web/` | Next.js app: `app/layout.tsx`, `app/page.tsx` (placeholder), `app/globals.css` (imports tokens), `public/brand/` (wordmark), `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `.env.example` |
| `packages/shared/` | `package.json` (`@emr/shared`), `src/index.ts`, `src/env.ts` (zod env helper), `src/slug.ts` (+ test), `vitest.config.ts` |
| `n8n/normalizers/` | `_common.js` (helpers from `docs/N8N_WORKFLOWS.md` §7), `normalizers.test.ts` (smoke test that `_common.js` loads and `iso()` / `noAt()` behave), `fixtures/.gitkeep`. Actor normalizers `<actor>.js` and their fixtures `fixtures/<actor>/` are added in M04–M06 |
| `vitest.workspace.ts` (root) | Vitest projects: `packages/shared`, `apps/web`, `n8n/normalizers` (node environment). `pnpm test` at the root runs all of them |
| `supabase/README.md`, `n8n/README.md`, `scripts/README.md` | Placeholders explaining what comes in which milestone |
| `.github/workflows/ci.yml` | Jobs: install (pnpm cache), lint, format check, typecheck, unit tests, build; `db-tests` job commented, with a note "enabled in M01" |
| `.github/dependabot.yml` | npm (weekly, grouped) + github-actions (monthly) |
| `.github/pull_request_template.md` | Checklist: milestone ID, PROGRESS.md updated, tests run, no secrets, docs updated |
| `.github/CODEOWNERS` (optional) | `* @muhhammeddsayedd-prog` |
| `.gitignore` | node_modules, .next, coverage, playwright-report, `.env*` (except `.env.example`), `supabase/.temp`, `.vercel`, `*.local` |
| `README.md` | Human overview + dev quickstart (replaces the pack README; keep its "how to use this pack" section) |
| Handoff pack files | Copied unchanged to the repo root |

## 7. Tasks

### T1: Initialise the repo and copy the handoff pack
1. Clone the repo, create branch `m00-bootstrap`.
2. Copy the pack folders and files into the repo root, keeping paths: `AGENTS.md`, `PROGRESS.md`, `DESIGN.md`, `README.md`, `docs/`, `milestones/`, `data/`, `reference/`, `assets/`, `templates/`.
3. Commit: `chore(repo): add handoff pack (docs, milestones, data, reference)`.

**Done when:** `git ls-files | wc -l` shows the pack files, and `PROGRESS.md` is at the root.

### T2: Workspace root
1. `corepack enable && corepack prepare pnpm@latest --activate`, then check the version and pin it in `packageManager`.
2. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
3. Root `package.json` (root devDependency `vitest`; `pnpm test` = `vitest run` over the root workspace from step 5, which covers `packages/*`, `apps/web` and `n8n/normalizers` — `pnpm -r test` would skip `n8n/normalizers` because it is not a workspace package):
   ```json
   {
     "name": "everyone-market-radar",
     "private": true,
     "packageManager": "pnpm@<pinned>",
     "engines": { "node": ">=24 <25" },
     "scripts": {
       "dev": "pnpm --filter web dev",
       "build": "pnpm -r build",
       "lint": "pnpm -r lint",
       "typecheck": "pnpm -r typecheck",
       "test": "vitest run",
       "test:e2e": "pnpm --filter web test:e2e",
       "format": "prettier --write .",
       "format:check": "prettier --check ."
     }
   }
   ```
4. Add `.nvmrc` (`24`), `.editorconfig`, `.npmrc` (`auto-install-peers=true`, `strict-peer-dependencies=false` only if needed), `tsconfig.base.json`, `.gitignore`.

**Done when:** `pnpm install` succeeds on an empty workspace.

### T3: Next.js app `apps/web`
1. Scaffold with the current official command, verifying flags in the Next.js docs:
   ```bash
   pnpm create next-app@latest apps/web --ts --app --eslint --tailwind --src-dir=false --import-alias "@/*" --use-pnpm
   ```
   Set the package name to `web`.
2. Pin exact versions (no `^`) for `next`, `react` and `react-dom`, and commit the lockfile.
3. Copy `assets/brand/tokens.css` to `apps/web/styles/tokens.css` and import it in `app/globals.css`. Map Tailwind v4 theme tokens (`@theme`) to the CSS variables, as described in DESIGN.md / tokens.css.
4. Copy `assets/brand/everyone-logotype.svg` to `apps/web/public/brand/everyone-logotype.svg`.
5. Build `app/page.tsx`: a black full-viewport page with the wordmark centred in white (about 240px wide), the label "Market Radar" under it as an uppercase micro-label (14px, 0.14px tracking, gray `#7d7f82`), and a footer line "Internal · everyone." No data, no auth.
6. In `app/layout.tsx`:
   - set `<html lang="en">` and a `metadata` title "everyone. Market Radar";
   - set `robots: { index: false, follow: false }`, since this is an internal tool;
   - use the font stack from the tokens.
7. Scripts in `apps/web/package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`).

**Done when:** `pnpm dev` serves the placeholder at http://localhost:3000, and `pnpm --filter web build` passes.

### T4: Shared package `packages/shared`
1. Create `package.json` with name `@emr/shared`, `"type": "module"`, exports `./src/index.ts` (TS source consumed via Next.js `transpilePackages: ['@emr/shared']`), and scripts `lint`, `typecheck` and `test`.
2. `src/slug.ts`: `toSlug(name)`, which lowercases, turns `&` into `and`, turns non-alphanumerics into `-`, and trims. It must match how `data/competitors.csv` slugs were made. Add `src/slug.test.ts`, which checks 5 rows from `data/competitors.csv` (e.g. "Good People" → `good-people`).
3. `src/env.ts`: a zod helper `parseEnv(schema)` for server env validation (used from M09).
4. Create placeholders `src/db.types.ts` (generated in M01) and `src/normalizers/README.md` (filled in M04–M06).
5. Add `@emr/shared` as a workspace dependency of `web`.

**Done when:** `pnpm --filter @emr/shared test` passes.

### T5: Lint, format and typecheck
1. Use ESLint flat config (`eslint.config.mjs`) at the root: `typescript-eslint` recommended + `eslint-config-next` for `apps/web`, with `no-console: warn` (allow `console.error`).
2. Prettier (`.prettierrc`: `{ "singleQuote": true, "semi": true, "printWidth": 110 }`) and `.prettierignore` (lockfile, `.next`, `reference/sql`, `data/*.csv`, `n8n/workflows/*.json`).
3. Every package gets a `typecheck` script (`tsc --noEmit -p .`).

**Done when:** `pnpm lint && pnpm format:check && pnpm typecheck` all pass.

### T6: Tests
1. Vitest in `packages/shared` and `apps/web` (jsdom environment for web), plus `apps/web/components/__tests__/placeholder.test.tsx` checking the page renders the "Market Radar" label.
   - Also set up a root Vitest workspace (`vitest.workspace.ts`, or `test.projects` in a root `vitest.config.ts`, per the current Vitest docs) that includes `n8n/normalizers/**/*.test.ts`.
   - Add `n8n/normalizers/_common.js`, the canonical helpers copied from `docs/N8N_WORKFLOWS.md` §7. It is plain JS, so n8n Code nodes can paste it; export with `module.exports` guarded by `typeof module !== 'undefined'`.
   - Add `n8n/normalizers/normalizers.test.ts`, which loads `_common.js` and tests `iso(1700000000)`, `noAt('@Foo')` → `foo` and `tags('#Ramadan')` → `['ramadan']`.
   - Root `test` script: `vitest run` over the workspace, plus per-package scripts.
2. Playwright:
   ```bash
   pnpm --filter web exec playwright install --with-deps chromium
   ```
   - Add `apps/web/playwright.config.ts`, with `webServer` running `pnpm build && pnpm start` on port 3000.
   - Add `e2e/smoke.spec.ts`: the page loads, the title contains "Market Radar", and the wordmark `img` or `svg` is visible.
   - Add `@axe-core/playwright` with an a11y check (no serious or critical violations).

**Done when:** `pnpm test` and `pnpm test:e2e` pass locally.

### T7: CI and repo hygiene
1. Create `.github/workflows/ci.yml`:
   - **Triggers:** `pull_request` and `push` to `main`.
   - **Setup:** ubuntu-latest, `actions/setup-node` with `node-version-file: .nvmrc`, `pnpm/action-setup`, pnpm store cache.
   - **Jobs:**
     - `quality`: install → lint → format:check → typecheck.
     - `unit`: test.
     - `build`: `pnpm --filter web build` (no env needed yet).
     - `e2e`: needs `build`; installs chromium; runs `test:e2e`.
     - `db-tests`: commented out, with the note "enabled in M01: supabase start + db reset + test db".
2. Create `.github/dependabot.yml` (npm weekly grouped minor/patch; github-actions monthly).
3. Create `.github/pull_request_template.md`:
   ```markdown
   ## Milestone
   Mxx — <name> · task(s): T…
   ## What changed
   ## Evidence (tests / screenshots / SQL)
   ## Checklist
   - [ ] milestones/Mxx/PROGRESS.md updated (tasks ticked, log line, next step)
   - [ ] Root PROGRESS.md board updated if status changed
   - [ ] No secrets, .env or credential-bearing exports committed
   - [ ] Docs updated for any deviation (DECISIONS → Changes)
   - [ ] CI green
   ```
4. Optionally add `.github/CODEOWNERS`.
5. Push the branch, open the PR, and get CI green.
6. Then ask the owner (MA-01) to enable branch protection on `main`: PR required, the `quality`, `unit` and `build` checks required.

**Done when:** the PR shows green checks.

### T8: Vercel preview (needs MA-02)
1. The owner imports the repo in Vercel with root directory `apps/web` and framework Next.js. Install command: `pnpm install --frozen-lockfile`, run from the root (Vercel detects workspaces; set "Include files outside the root directory" if prompted).
2. Confirm the PR gets a preview URL, and that the URL renders the placeholder.
3. Record the preview URL in PROGRESS.md.

**Done when:** the preview URL works.

### T9: README and hand-off
1. Root `README.md`:
   - what the project is (2 lines);
   - prerequisites (Node 24, pnpm, Docker for M01);
   - quickstart (`pnpm i`, `pnpm dev`);
   - scripts table;
   - repo map;
   - "How we work" (milestones + PROGRESS) linking `AGENTS.md`.
2. Update root `PROGRESS.md` (M00 Done, current milestone M01) and fill in this milestone's hand-off.
3. Merge the PR after the owner's OK.

**Done when:** merged into `main` with CI green.

## 8. Interfaces & contracts touched

| Item | Contract |
|---|---|
| Workspace package names | `web` (apps/web), `@emr/shared` (packages/shared). Later milestones import `@emr/shared`. |
| Root scripts | `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `format:check`. CI and later milestones rely on these names. |
| Env | No env needed in M00. `apps/web/.env.example` = `templates/.env.example`. |
| Brand files | `apps/web/public/brand/everyone-logotype.svg`, `apps/web/styles/tokens.css` |

## 9. Acceptance criteria

| # | Criterion | How to check |
|---|---|---|
| AC1 | The repo contains the handoff pack at the root | `test -f AGENTS.md && test -f milestones/M00-repo-bootstrap/MILESTONE.md` → ok; `ls milestones` lists M00–M15; `ls docs` lists PRD, TECHNICAL, DATA_SCHEMA, … |
| AC2 | Install from clean works | `rm -rf node_modules && pnpm install --frozen-lockfile` exits 0 |
| AC3 | Quality gates pass | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` exit 0 |
| AC4 | The placeholder page works | `pnpm dev` → http://localhost:3000 shows the white everyone. wordmark on black + "MARKET RADAR"; `pnpm test:e2e` passes, including the axe check |
| AC5 | CI is green on the PR and on `main` | GitHub Actions: `quality`, `unit`, `build`, `e2e` green |
| AC6 | The Vercel preview renders the page | Preview URL recorded in PROGRESS.md |
| AC7 | No secrets are tracked | `git ls-files \| grep -E '\.env($\|\.)' \| grep -v example` → empty; `.gitignore` covers `.env*` |
| AC8 | Dependabot and the PR template are present | `.github/dependabot.yml` and `.github/pull_request_template.md` exist |
| AC9 | Branch protection is on (owner) | The owner confirms in PROGRESS (MA-01) |

## 10. Tests to write

- `packages/shared/src/slug.test.ts`: slug rules against CSV examples.
- `apps/web/components/__tests__/placeholder.test.tsx`: the label renders.
- `apps/web/e2e/smoke.spec.ts`: the page loads, the title is right, the wordmark is visible, axe finds no serious issues.
- `n8n/normalizers/normalizers.test.ts`: tests for the common helpers. M04–M06 extend it with per-actor contract tests against fixtures.

## 11. Manual actions from the owner

| MA | What | When in this milestone | How Codex verifies |
|---|---|---|---|
| MA-01 | Give Codex push and PR rights. After CI exists, protect `main` (PR required + `quality`/`unit`/`build` checks) | Before T1; protection after T7 | Codex can push `m00-bootstrap`; a direct push to `main` is rejected |
| MA-02 | Create the Vercel project from the repo (root `apps/web`) | T8 | The preview URL appears on the PR |

## 12. Risks & gotchas

- **Verify current docs:**
  - the `create-next-app` flags and the default Tailwind version (v4 uses `@import "tailwindcss"` and `@theme`, not `tailwind.config.js`);
  - the ESLint flat-config support in `eslint-config-next`;
  - Vercel's monorepo settings for pnpm.
- **Copy the handoff pack exactly.** Don't reformat `data/*.csv` or `reference/sql/*.sql` with Prettier; they are in `.prettierignore`.
- **`transpilePackages`:** Next.js must transpile `@emr/shared`, because it is TS source.
- **Playwright in CI:** install only chromium, to keep CI fast.
- **Don't add UI libraries beyond those in TECHNICAL §3.** No component kit other than Radix/shadcn-style primitives, which arrive in M09.

## 13. Cost & budget notes

Vercel Hobby can host previews for M00. Upgrade to Pro before M09, when there are team users (see `docs/ENVIRONMENT.md`). There are no paid API calls in this milestone.

## 14. Definition of done & hand-off

- All ACs pass, with the evidence in PROGRESS.md; the PR is merged; root PROGRESS.md shows M00 Done and M01 current.
- **M01 expects:**
  - a monorepo with `supabase/` ready for `supabase init`;
  - CI with a placeholder `db-tests` job to enable;
  - `packages/shared/src/db.types.ts` as the target for generated types;
  - Docker available locally for `supabase start`.
