# M06 isolated upkeep policy slice —29 October2026

Branch `m06-upkeep-local`, based on accepted `e8dcee8`. This worktree is isolated from the separately prepared/running story comparison. It reads no credentials, makes no provider/database/Storage request, and carries no campaign runtime binding. The accepted application8aed186/workflow780184f,13 stories/JPEGs, prior media/source results and cleanup are unchanged.

## Implemented local behavior

- `n8n/collectors/upkeep.mjs` defines the existing free90-day removal/daily30-day metrics and paid weekly30-day removal/metrics windows. It does not change source watermarks or cadence. Setting overrides remain finite and validated.
- Paid listing INPUT planning reuses approved Instagram/LinkedIn contracts and exact owned account identities. Instagram posts include pinned posts; reels omit the unsupported pinned option. The finite result limit is explicitly not source-completeness evidence.
- Removal eligibility requires a successful source, exact account/platform/pass/requested-date agreement, valid owned normalized entries and a complete date range supported by exhaustion or crossing the requested date. An empty listing, hit cap, remaining cursor or incomplete range blocks removal. The suspicious-low-count check counts unique IDs, not repeated rows.
- Instagram posts/reels share one account. A single complete pass can refresh observed metrics, but cannot produce account-level removal arguments. Two independently complete pass receipts must be joined; an explicit complete empty reels pass can join a nonempty posts pass, while two empty passes still cannot mass-remove.
- The local coordinator refreshes observed metrics first and calls a supplied removal port only after the guard passes. It does not retry ambiguous writes, checks cancellation before each mutation and replaces arbitrary transport errors with fixed reconciliation codes. Existing immutable/human-lock/idempotent write rules remain responsibilities of the future concrete restricted ports.
- `upkeep-health.mjs` consumes the actual shared `health.read` validator and projects the full M06 health result. Missing legacy fields remain unknown, null capture gap is not zero, and generic media depth is not misrepresented as dedicated story-queue depth. It sends no email and changes neither historical WF-91 nor its required source guard.

## Actual qualification

`node --test n8n/collectors/upkeep*.test.mjs`: **21 passed,0 failed/skipped**. Local synthetic contracts cover wrong identities/dates, caps/partial/empty sources, pinned posts, posts/reels settlement, deduplication, UTC metric-window boundaries including offsets, refresh/removal ordering, cancellation/uncertain writes, legacy/current health, partial upgrades and private diagnostic rejection.

Owned ESLint, Prettier and `git diff --check` pass. Tests reuse already installed public dependency directories via ignored local junctions; no package/skill installation, global configuration change or private input occurs. The first health test stopped because this new worktree lacked the package-scoped zod dependency link; the correct existing shared dependency link resolved it. That setup failure is local only, not a product/runtime failure.

Normal required changed-head CI remains to be run through the permitted branch route. The root coordinator owns the narrow CI trigger addition; this slice does not weaken, skip or replace a required job.

## Honest remaining boundaries

No `ops.get_removal_targets` or `ops.mark_removed` implementation exists in the accepted22-version schema. This slice does not export an unimplemented port as a working native WF-40. Concrete RPCs, trusted source-coverage adapters, generated types/SQL tests, actual local SQL composition and an inactive native graph remain development work. Paid website removal remains dependent on its own supported listing/coverage contract; the denied M05 website correction is untouched.

The maintained health read-result projection is local integration, not a published WF-91, actual health read, stats refresh or email receipt. Full M06 criteria remain open. No hosted removal mutation, comparison capture, email, cadence switch, Production, merge or M07 occurs here.
