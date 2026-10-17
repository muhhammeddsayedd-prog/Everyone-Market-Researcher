# M00 — Repo bootstrap & tooling · PROGRESS

> Read with `MILESTONE.md`; all evidence below belongs to M00 only.

## Status

**In progress**

| Field        | Value                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------- |
| Started      | 2026-10-17                                                                                |
| Last updated | 2026-10-17                                                                                |
| Finished     | —                                                                                         |
| Branch / PR  | `m00-bootstrap` / pending implementation push                                             |
| Current task | T6 browser checks; T7 CI; T8 preview; T9 documentation                                    |
| Next step    | Finish browser checks, clean frozen install, independent review; push branch and open PR. |

## Task checklist

- [x] T1 — Initialize in place and preserve handoff and installed skills (`423e301`); approved empty `main` base `1946db4` published.
- [x] T2 — Workspace root; Node 24 / pnpm 10.34.7; exact pins and lockfile; install passed.
- [x] T3 — Next.js placeholder; strict TypeScript; build and component test passed.
- [x] T4 — Shared package; 19 shared tests and 16 canonical helper tests passed.
- [x] T5 — Lint, formatting, strict typecheck; all passed.
- [ ] T6 — Root unit suite passed 39 tests / 5 files; built-app Playwright/axe pending.
- [ ] T7 — CI and repo hygiene implemented; hosted checks pending push/PR.
- [ ] T8 — Vercel preview (MA-02 configured; preview pending).
- [ ] T9 — README and hand-off; merge requires explicit owner approval.

## Acceptance criteria

| ID  | Result  | Evidence                                                                                                    |
| --- | ------- | ----------------------------------------------------------------------------------------------------------- |
| AC1 | PASS    | Handoff, M00–M15 folders, docs/data/reference/assets/skills tracked; `423e301`.                             |
| AC2 | NOT RUN | Initial install passed; clean checkout frozen install pending.                                              |
| AC3 | PASS    | `pnpm lint`, `format:check`, `typecheck`, `test`; `evidence/{lint,format,typecheck,unit}.log`; 39/39 tests. |
| AC4 | NOT RUN | Production build passed (`evidence/build.log`); browser checks pending.                                     |
| AC5 | NOT RUN | PR/main CI pending; no local result substitutes for hosted checks.                                          |
| AC6 | NOT RUN | Project configured; preview build/render pending.                                                           |
| AC7 | PASS    | Targeted index scan before handoff commit: 481 files, 0 findings. Final index scan pending.                 |
| AC8 | PASS    | `.github/dependabot.yml`, `pull_request_template.md` implemented.                                           |
| AC9 | BLOCKED | GET main protection returned 404 "Branch not protected"; owner action MA-01.                                |

## Blockers

- MA-01: owner-controlled main branch protection must require a PR and `quality`, `unit`, `build` checks after CI appears.
- Merge approval and post-merge main checks are required before Done. All local implementation work continues.

## Manual actions needed from the owner

| ID             | Exact action                                                                                                                                                                                                                   | Status                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| MA-01          | GitHub repo → Settings → Branches → Add branch protection rule → `main`; require a pull request before merging; require status checks `quality`, `unit`, `build`; save. Confirm here. Do not test by pushing directly to main. | Access verified ADMIN; empty main base explicitly approved/published; protection still owner-controlled. |
| MA-02          | Owner authorized project creation/linking in this session. No repeat setup requested.                                                                                                                                          | Existing project discovered via authenticated CLI and configured; preview verification pending.          |
| Merge approval | Review the completed M00 PR and explicitly approve merge.                                                                                                                                                                      | Not requested until implementation/evidence ready.                                                       |

## Decisions & deviations

- No clone/re-extraction: the existing workspace is the repository root. Empty main `1946db4` was published only after explicit owner approval; all implementation stays on `m00-bootstrap`.
- `emr-milestone-delivery` is not installed; existing project rules/milestone records provide its workflow. No separate baseline/review report found; absence did not block work.
- Verified exact compatible package pins against official docs/registry. TypeScript 6.0.3 meets typescript-eslint's `<6.1` peer range; TypeScript 7 is deferred. ESLint 9.39.5 is deprecated upstream but is the supported intersection for current Next import/React/accessibility plugins; ESLint 10 gave peer incompatibilities and was replaced before delivery. See `evidence/toolchain.md`.
- Current Vitest `test.projects` replaces deprecated workspace config; normalizer config uses `.mts` within a private CommonJS boundary so canonical plain-JS exports load correctly.
- M00 system-font fallback avoids requesting absent M09 font files. Copied canonical CSS/SVG bytes are preserved; external SVG rendered white via CSS filter.
- MR-08 corrected only JSON mirror entries; canonical CSS unchanged. Regression verifies all 136 dark/32 light key-value pairs and app stylesheet copy.
- Formatting checks cover implementation/active M00 records, preserving handoff docs, reference/seed assets and pinned skills. No binding product/security decision changed.
- Vercel MCP default-scope readback was incomplete: no projects/teams, user lookup404; creation/link attempt400 (missing GitHub login connection), explicit team read403. Authenticated CLI correctly found the owner's existing project. Project `prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`, team `team_gboXPxTevpCOZuaA8eY9PmR1`, expected Git repo verified; root `apps/web`, Next.js, Node24, frozen install, outside-root workspace files enabled. No new account or plan.

## Risks / notes for the owner

- Full dependency audit reports one high `braces` advisory GHSA-vfj7-8cjw-p6xm with no patched version. Controlled repository-only lint glob path; no public runtime input reaches it. Production-only audit exits0. Mitigation/deferral and review date2026-10-24 in toolchain evidence; no claim the full audit is clean.
- Initial formatter failed because Windows PowerShell wrote audit JSON as UTF-16; original failure retained in `evidence/format-initial.log`, receipts converted to UTF-8, formatter now passes. Initial lint monorepo-root warning fixed with `settings.next.rootDir` and named PostCSS export.
- n8n skill promotion stays at M03; no live workflow, scraping, database, AI or provider test is authorized/run in M00. M01 has not started.

## Session log

- 2026-10-17 · T2–T5 implementation: workspace/toolchain, web placeholder, shared/env/slug and common normalizers, strict tooling. Initial install0; lint0; format0; typecheck0; 39 unit/component/helper/token tests passed; production build0. Logs in `evidence/`. Sources and exact versions in `evidence/toolchain.md` and `web-implementation.md`.
- 2026-10-17 · T1 committed `423e301`: preserved handoff/assets/installed skill sources and receipts. Tracked secret pattern scan:481 files/0 findings. Root initialized in place. After explicit owner response, empty main base1946db4 pushed; implementation remains unmerged.
- 2026-10-17 · Owner authorized M00 only; initial GitHub readback ADMIN/empty repository. Node24.18.0 installed. Local and hosted work proceeding within M00. No essential installed delivery wrapper/baseline report; existing progress structure retained.
- 2026-10-17 · Separate owner request: installed the single default Taste skill in `.agents/skills/design-taste-frontend/`, added frontend routing in `AGENTS.md`/project rules, retained source/license/patch receipts and refreshed the skill lock/validator. Dashboard mode preserves `DESIGN.md`; patched local history and lint redaction passed synthetic fixtures, and all eight JS module syntax checks passed. Native discovery/integrity evidence is in `.agents/skill-receipts/validation.json`. M00 tasks, criteria, manual actions and next step remain unchanged; no Git repository exists for a commit.
- 2026-10-17 · Installed 28 upstream skills locally, added project routing/policies, pinned references/licenses and retained n8n as pending; files: `.agents/`, `SKILLS_SETUP.md`, `SKILLS_LOCK.json`, `scripts/validate_project_skills.py`, root `AGENTS.md`/`PROGRESS.md`. Native discovery and static integrity checks are recorded in `.agents/skill-receipts/`; application/hosted tests were not run. Initial byte comparison stopped on a CRLF checkout conversion; verification was corrected to compare against immutable Git blobs, preserving the installed files. M00 status and next step are unchanged.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone

<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->

- —
