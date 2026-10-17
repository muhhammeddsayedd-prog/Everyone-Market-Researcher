# Project-local skills setup

Prepared 17 October 2026 for everyone. Market Radar. **28 of the 29 selected
upstream entries are installed in `.agents/skills/`.** The n8n release is verified
and retained as pending; its actual Cloud runtime gate is unresolved. Application
development has not started and M00 remains `Not started`.

The exact supplied plan is retained in
`.agents/skill-receipts/installation-plan.txt`. Its companion JSON allowlist was
not supplied; the 29 names in the text were used without adding optional or
excluded entries. The proposed `emr-milestone-delivery` was not created; its scope
is described separately in [the project skill rules](.agents/PROJECT_SKILL_RULES.md).

## Installed sources and paths

| Source | Immutable commit | Installed names and source paths |
|---|---|---|
| [Addy](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d) | `aeac41d4d005999432bb7312f7ff06383a91d59d` | 22 entries listed below; source `skills/<name>` |
| [Vercel](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278) | `063bee94c3f4df8453406c830b0a7df0f2860278` | `vercel-react-best-practices` ← `skills/react-best-practices`; `vercel-composition-patterns` ← `skills/composition-patterns`; `web-design-guidelines` and `vercel-optimize` ← same-named `skills/` directories |
| [Supabase](https://github.com/supabase/agent-skills/tree/c9be0e931b7930f7d02126d04774d904c381e7d7) | `c9be0e931b7930f7d02126d04774d904c381e7d7` | `supabase`, `supabase-postgres-best-practices` ← same-named `skills/` directories |

Each installed directory is `.agents/skills/<manifest-name>/`, using copied
files rather than symlinks. [SKILLS_LOCK.json](SKILLS_LOCK.json) records each
source path, original file hash, installed file hash and all 350 locked files.
The complete 312 selected upstream files were byte-verified against immutable
Git blobs before local patches. Seven shared Addy checklists live in
`.agents/references/`, preserving `../../references/` and nested relative paths.

The 22 Addy entries are:

```
context-engineering
planning-and-task-breakdown
incremental-implementation
test-driven-development
source-driven-development
debugging-and-error-recovery
api-and-interface-design
security-and-hardening
code-review-and-quality
doubt-driven-development
git-workflow-and-versioning
ci-cd-and-automation
documentation-and-adrs
observability-and-instrumentation
frontend-ui-engineering
browser-testing-with-devtools
performance-optimization
code-simplification
deprecation-and-migration
shipping-and-launch
spec-driven-development
constraint-driven-development
```

The web guideline dependency is pinned separately to
[`vercel-labs/web-interface-guidelines@434b7f91364665f2f733b310ec54809bf8f37937`](https://github.com/vercel-labs/web-interface-guidelines/tree/434b7f91364665f2f733b310ec54809bf8f37937).
Its complete `command.md` and MIT license are in
`.agents/skills/web-design-guidelines/references/`; the command SHA-256 is
`d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`.
Reviews read this snapshot instead of fetching mutable `main`.

## Local patches and preserved controls

All 28 manifests link to the project rules. Root `AGENTS.md` gained a local
skills section; it was not replaced. Project decisions, existing milestone
plans/progress, tests, Everyone branding and authorization take precedence.

- `spec-driven-development`, `constraint-driven-development` and
  `vercel-optimize` have `policy.allow_implicit_invocation: false` in their own
  `agents/openai.yaml`. Their selection is explicit-only; this does not authorize
  costs or production operations.
- Supabase's direct-SQL-then-pull migration advice was replaced with generated
  migration files, local replay/tests, advisors and regenerated types. RLS on
  every table, shared visibility and the project's restricted roles/secret use
  remain binding.
- Addy planning uses the existing milestone records and accepted scope. The
  recurring cross-model prompt and CLI examples were removed; native risk-focused
  review follows available harness capabilities. No excluded interview/router or
  upstream persona directory was installed.
- Destructive reset recovery and secret-printing grep examples were replaced.
  The embedded floor-guard example now records only rule/file metadata. These
  Markdown examples were not executed or installed as hooks.
- Three React compiled-guide links and spec sibling skill paths were repaired.
  The guideline fetch was replaced with the pinned local dependency.

Unified diffs and old/new hashes for 32 changed upstream files are retained in
`.agents/skill-receipts/local-patches.json`. The ten focused Addy replacements
are also retained. The three new policy files and two guideline dependency files
are additional resources, recorded in the lock.

Upstream license evidence is in `.agents/skill-receipts/licenses/`. Addy and
Supabase LICENSE files are retained. Vercel agent-skills has no LICENSE file at
this pin, so its exact README declaring MIT and the manifest declarations are
preserved; no license text or copyright was invented. The guideline has its own
LICENSE. All exact upstream license evidence uses Git blob bytes.

The OpenAI installer and its helper were reviewed and pinned by SHA-256 before
use; exact copies are in `.agents/skill-receipts/installer/`. Imports used
immutable refs and an explicit repository destination, with ambient GitHub token
variables removed from the helper's process environment. One-time session code
is archived as non-executable text evidence under `setup-tools/`; it depends on
that session's temporary checkouts and is not a portable updater.

## Pending n8n entry

The [v2.22.0 release](https://github.com/haunchen/n8n-skills/releases/tag/v2.22.0)
resolves to commit `1fe379099249d905e9bd7dfa212e65c8832153a8`. Its actual manifest
name is `n8n-skills`, version `2.22.0`, documenting n8n `v2.36.8`.

The unchanged 530,228-byte ZIP has SHA-256
`898eb84f09bc8f59535ee0d6b365e97b61a050ff9cfb77ce313a23ff890e4a6e`, matching
GitHub's asset digest. The 126 Markdown files have safe archive paths and no
scripts/hooks. Main-manifest resources resolve; four template YouTube links
need future portability repairs. LICENSE and ATTRIBUTIONS were absent from the
ZIP and were supplemented from the pinned source commit. A JWT-shaped tutorial
metadata fingerprint was identified without printing its value; it is not a
project credential. The archive remains unchanged and templates remain untrusted.

The [pending receipt](.agents/skill-receipts/pending/n8n-skills/PENDING.md) retains
the archive, release/tag metadata, manifest snapshot, licenses and static review.
There is no discoverable n8n `SKILL.md`. At M03 T1, verify the actual Cloud
runtime, relevant node schemas/typeVersions and restrictions, record any version
mismatch, then review/preserve resources and patches before promotion. No hosted
n8n read or workflow execution was performed for setup.

## Verification and evidence boundary

Run from the project root:

```powershell
python -X utf8 scripts/validate_project_skills.py
python -X utf8 scripts/validate_project_skills.py --discovery
python -X utf8 scripts/validate_project_skills.py --discovery --setup-boundaries
```

The first command is offline. The second additionally runs local Codex stdio
`initialize` and `skills/list` with forced reload; it creates no model turn.
The third also checks the original setup-only preservation snapshot; use that
mode for this installation receipt, not after later authorized app development.
Results are in `.agents/skill-receipts/validation.json` and `discovery.json`.
The setup run passed:

| Check | Result |
|---|---|
| Native Codex discovery/frontmatter | 28 enabled repo-scoped skills; zero project parse errors or exact-name collisions; CLI `0.162.0-alpha.17.2` |
| Integrity | 350 locked files; complete selected source resources retained |
| Relative references | 92 local Markdown links and 20 inline relative resource paths resolve; excludes illustrative fenced code and remote links |
| Explicit-only policy files | All three match the requested policy; native parsing accepted their metadata |
| Existing skills | 120 pre-existing global/plugin manifests unchanged; zero pre-existing project skills |
| Existing handoff | 74 of 77 original files unchanged; only root `AGENTS.md`, root `PROGRESS.md` and M00 `PROGRESS.md` edited |
| Credential-pattern scan | 324 installed/reference text files passed the targeted redacted check; not an exhaustive security audit |
| Routing | Four non-executing examples reviewed: RLS migration, duplicate callback, accessible filter panel, proposed production backfill; owner approval boundary retained |

The existing Vercel plugin's `react-best-practices` is a different manifest and
procedure from `vercel-react-best-practices`. It remains untouched; project routing
chooses the local import for this guidance and avoids redundant reviews.

Only optimize contains runnable upstream helpers: 15 scripts and 74 library
modules. They were reviewed as source and retained, not executed. They can read
Vercel account/project/metrics/configuration and write local reports. Its required
observability, Windows scanner behavior and live target are unverified. DevTools
capability is not supplied by a skill. No app, DB, Playwright/axe, live provider,
hosted workflow, production or paid acceptance test was run. Policy files were
checked statically; behavioral implicit-selection tests were not run.

An initial import comparison stopped on CRLF conversion in a temporary checkout.
It was corrected to compare immutable Git blob bytes, and existing imports were
verified without replacement. PyYAML was unavailable, so native Codex parsing was
used rather than adding a dependency. No global settings, packages, hooks, new
provider connections, workflow runs, email or deployments were created.

The folder is not a Git repository. No Git initialization, commit, branch, push or
PR was performed. The next application step remains M00 T1 when authorized.
The setup-only changed/added paths are recorded in
`.agents/skill-receipts/final-diff.json`.

Codex's [official skill documentation](https://learn.chatgpt.com/docs/build-skills)
describes `.agents/skills/` discovery and explicit-only metadata. These local
skills will be available on the next turn. If the current UI does not refresh,
restart Codex. Future updates require deliberate pin/review/patch/lock work;
skills are not automatically refreshed before development.
