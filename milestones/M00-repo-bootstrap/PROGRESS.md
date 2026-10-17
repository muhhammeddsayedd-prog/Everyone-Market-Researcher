# M00 — Repo bootstrap & tooling · PROGRESS

> Read with `MILESTONE.md`; all evidence below belongs to M00 only.

## Status

**In review**

| Field        | Value                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Started      | 2026-10-17                                                                                                              |
| Last updated | 2026-10-17                                                                                                              |
| Finished     | —                                                                                                                       |
| Branch / PR  | `m00-bootstrap` / [PR #1](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/1)                   |
| Current task | T7 final CI verification; owner MA-01 protection/merge; T9 closeout                                                     |
| Next step    | Verify the documentation/evidence push checks; owner protects main and approves merge; verify main CI. Stop before M01. |

## Task checklist

- [x] T1 — Initialize in place and preserve handoff and installed skills (`423e301`); approved empty `main` base `1946db4` published.
- [x] T2 — Workspace root; Node 24 / pnpm 10.34.7; exact pins and lockfile; install passed.
- [x] T3 — Next.js placeholder; strict TypeScript; build and component test passed.
- [x] T4 — Shared package; 19 shared tests and 16 canonical helper tests passed.
- [x] T5 — Lint, formatting, strict typecheck; all passed.
- [x] T6 — 39 unit/component/helper/token tests / 5 files and 4 production Playwright/axe viewport checks passed; separate dev smoke passed.
- [ ] T7 — CI/hygiene committed fe5e057; PR #1 open. Initial quality failed only uncommitted root-doc formatting; final rerun pending.
- [x] T8 — MA-02 configured and Git-linked preview READY for fe5e057; browser title, wordmark, label/footer, black background and noindex verified.
- [ ] T9 — README and local hand-off ready; merge/main CI requires explicit owner approval.

## Acceptance criteria

| ID  | Result  | Evidence                                                                                                                                                                                                                                                                                             |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | PASS    | Handoff, M00–M15 folders, docs/data/reference/assets/skills tracked; `423e301`.                                                                                                                                                                                                                      |
| AC2 | PASS    | Separate `.m00-clean-20261017` clone of42149c1: no node_modules before install; frozen install0 in11.8s; no tracked changes. `evidence/clean-install.log`.                                                                                                                                           |
| AC3 | PASS    | `pnpm lint`, `format:check`, `typecheck`, `test`; `evidence/{lint,format,typecheck,unit}.log`; 39/39 tests.                                                                                                                                                                                          |
| AC4 | PASS    | Fresh production build + Playwright/axe4/4 at320/768/1024/1440; `evidence/web-e2e.log`, `web-*.png`; dev smoke HTTP200/no runtime errors `web-dev-smoke.json`.                                                                                                                                       |
| AC5 | BLOCKED | [Initial PR run39051922338](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39051922338): unit/build/e2e passed; quality failed only README/board formatting, preserved in `ci-quality-initial.*`. Corrected commit rerun pending. Main CI requires approved merge. |
| AC6 | PASS    | [Preview](https://everyone-market-researcher-hhy3j3p21-muhammed-abdelrahman.vercel.app) READY, branch m00-bootstrap, commitfe5e0574cfb81ff81dc5d680991d81e55ba8f8f4; CUA Chrome rendering verified, `evidence/preview-readback.json`.                                                                |
| AC7 | PASS    | Targeted indexed-content scan before CI commit:535 files/0 findings; documented env examples only, real env paths ignored. Final staged scan reruns before delivery.                                                                                                                                 |
| AC8 | PASS    | `.github/dependabot.yml`, `pull_request_template.md` implemented.                                                                                                                                                                                                                                    |
| AC9 | BLOCKED | GET main protection returned 404 "Branch not protected"; owner action MA-01.                                                                                                                                                                                                                         |

## Blockers

- MA-01: owner-controlled main branch protection must require a PR and `quality`, `unit`, `build` checks after CI appears.
- Merge approval and post-merge main checks are required before Done. All local implementation work continues.

## Manual actions needed from the owner

| ID             | Exact action                                                                                                                                                                                                                   | Status                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| MA-01          | GitHub repo → Settings → Branches → Add branch protection rule → `main`; require a pull request before merging; require status checks `quality`, `unit`, `build`; save. Confirm here. Do not test by pushing directly to main. | Access verified ADMIN; empty main base explicitly approved/published; protection still owner-controlled.                                      |
| MA-02          | Owner authorized project creation/linking in this session. No repeat setup requested.                                                                                                                                          | Existing project discovered via authenticated CLI and configured; preview READY/rendering verified; no further owner project-creation action. |
| Merge approval | Review the completed M00 PR and explicitly approve merge.                                                                                                                                                                      | Not requested until implementation/evidence ready.                                                                                            |

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

- 2026-10-17 · T6–T8 evidence: final built-app browser/axe4/4, dev smoke passed; clean frozen install passed. Independent review found no outstanding required code issue (token authoring excluded from reviewer independence); mutation rejected3/14 slug cases. Owned `.m00-clean-review-mutation` cleanup was rejected by automatic approval review; folder left ignored without retry. Existing Vercel project configured and Git preview bound fe5e057 rendered in Chrome. Initial GitHub quality failed because formatted README/board were left out of the first push; fix and original failure evidence retained. PR#1 awaits final checks and owner gates.
- 2026-10-17 · T2–T5 implementation: workspace/toolchain, web placeholder, shared/env/slug and common normalizers, strict tooling. Initial install0; lint0; format0; typecheck0; 39 unit/component/helper/token tests passed; production build0. Logs in `evidence/`. Sources and exact versions in `evidence/toolchain.md` and `web-implementation.md`.
- 2026-10-17 · T1 committed `423e301`: preserved handoff/assets/installed skill sources and receipts. Tracked secret pattern scan:481 files/0 findings. Root initialized in place. After explicit owner response, empty main base1946db4 pushed; implementation remains unmerged.
- 2026-10-17 · Owner authorized M00 only; initial GitHub readback ADMIN/empty repository. Node24.18.0 installed. Local and hosted work proceeding within M00. No essential installed delivery wrapper/baseline report; existing progress structure retained.
- 2026-10-17 · Separate owner request: installed the single default Taste skill in `.agents/skills/design-taste-frontend/`, added frontend routing in `AGENTS.md`/project rules, retained source/license/patch receipts and refreshed the skill lock/validator. Dashboard mode preserves `DESIGN.md`; patched local history and lint redaction passed synthetic fixtures, and all eight JS module syntax checks passed. Native discovery/integrity evidence is in `.agents/skill-receipts/validation.json`. M00 tasks, criteria, manual actions and next step remain unchanged; no Git repository exists for a commit.
- 2026-10-17 · Installed 28 upstream skills locally, added project routing/policies, pinned references/licenses and retained n8n as pending; files: `.agents/`, `SKILLS_SETUP.md`, `SKILLS_LOCK.json`, `scripts/validate_project_skills.py`, root `AGENTS.md`/`PROGRESS.md`. Native discovery and static integrity checks are recorded in `.agents/skill-receipts/`; application/hosted tests were not run. Initial byte comparison stopped on a CRLF checkout conversion; verification was corrected to compare against immutable Git blobs, preserving the installed files. M00 status and next step are unchanged.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone

<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->

- Prepared only: workspace and credential-free placeholder, strict tooling, shared helpers, db.types placeholder and commented M01 CI job exist. Run README commands. M00 cannot close until MA-01 protection, explicit merge approval, merged main CI. M01 has not started and needs a separate instruction after M00 closes.
