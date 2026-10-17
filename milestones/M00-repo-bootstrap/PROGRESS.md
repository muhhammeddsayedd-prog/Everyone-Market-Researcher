# M00 — Repo bootstrap & tooling · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | 2026-10-17 |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | m00-bootstrap / pending initial main setup |
| Current task | T1–T6 local bootstrap |
| Next step | Implement and verify M00; publish review branch. MA-01 empty base and MA-02 project pending owner. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Initialise the repo and copy the handoff pack
- [ ] T2 — Workspace root
- [ ] T3 — Next.js app `apps/web`
- [ ] T4 — Shared package `packages/shared`
- [ ] T5 — Lint, format and typecheck
- [ ] T6 — Tests
- [ ] T7 — CI and repo hygiene
- [ ] T8 — Vercel preview (needs MA-02)
- [ ] T9 — README and hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — The repo contains the handoff pack at the root — evidence:
- [ ] AC2 — Install from clean works — evidence:
- [ ] AC3 — Quality gates pass — evidence:
- [ ] AC4 — The placeholder page works — evidence:
- [ ] AC5 — CI is green on the PR and on `main` — evidence:
- [ ] AC6 — The Vercel preview renders the page — evidence:
- [ ] AC7 — No secrets are tracked — evidence:
- [ ] AC8 — Dependabot and the PR template are present — evidence:
- [ ] AC9 — Branch protection is on (owner) — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- Local M00 is unblocked. Hosted PR requires main in the verified empty repository; preview requires MA-02.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-01 | Give Codex push/PR rights; protect `main` after CI exists | Codex needs to push; protection after T7 | Not requested yet |
| MA-02 | Create the Vercel project (root `apps/web`) | Preview deploys (T8) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Local M00 is unblocked. Hosted PR requires main in the verified empty repository; preview requires MA-02.

## Risks / notes for the owner
- The owner's separate skill-setup request did not authorize starting M00. T1–T9 and all M00 acceptance criteria remain unchecked. The handoff folder is not a Git repository yet; setup could not be committed without starting repo initialization.
- n8n skill installation remains pending the actual Cloud runtime/node typeVersion check at M03 T1; payload/license/link evidence is retained locally. This is not a new M00 owner action.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · Owner authorized M00 only. Verified GitHub ADMIN access and empty remote; initialized in place without replacing handoff/skills. Local empty base 1946db4, branch m00-bootstrap, expected origin connected. Node 24.18.0; pnpm 10.34.7 pinned. Vercel readback has no linked project and no teams. Requested MA-01 empty main setup approval and MA-02 project; all local tasks continue. emr-milestone-delivery is not installed (existing project rules cover its intended workflow); no baseline/review report found.
- 2026-10-17 · Separate owner request: installed the single default Taste skill in `.agents/skills/design-taste-frontend/`, added frontend routing in `AGENTS.md`/project rules, retained source/license/patch receipts and refreshed the skill lock/validator. Dashboard mode preserves `DESIGN.md`; patched local history and lint redaction passed synthetic fixtures, and all eight JS module syntax checks passed. Native discovery/integrity evidence is in `.agents/skill-receipts/validation.json`. M00 tasks, criteria, manual actions and next step remain unchanged; no Git repository exists for a commit.
- 2026-10-17 · Installed 28 upstream skills locally, added project routing/policies, pinned references/licenses and retained n8n as pending; files: `.agents/`, `SKILLS_SETUP.md`, `SKILLS_LOCK.json`, `scripts/validate_project_skills.py`, root `AGENTS.md`/`PROGRESS.md`. Native discovery and static integrity checks are recorded in `.agents/skill-receipts/`; application/hosted tests were not run. Initial byte comparison stopped on a CRLF checkout conversion; verification was corrected to compare against immutable Git blobs, preserving the installed files. M00 status and next step are unchanged.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->
- —
