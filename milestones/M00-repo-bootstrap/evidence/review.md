# M00 independent implementation review

Reviewed 2026-10-17 (Africa/Cairo). Scope: workspace/tooling, CI and repository hygiene,
the placeholder app, shared helpers and canonical n8n helper test wiring. The reviewer
authored the MR-08 token correction, so that correction is excluded from the independent
verdict. Its focused self-check passed separately: 3 Vitest tests.
The reviewed implementation commit is `fe5e057`; subsequent evidence/progress edits remain
separate. The final Next config sets `agentRules: false` to preserve project-authored rules.

**Verdict: no outstanding required code changes found in the reviewed M00 implementation.**
This supports opening the implementation PR. Hosted CI, preview acceptance, branch protection
and owner merge approval remain governed by the milestone progress record.

## Findings and resolutions

- **Resolved:** the root Vitest config referenced the nonexistent normalizer `.ts` config.
  It now references `n8n/normalizers/vitest.config.mts`; root typechecking includes `.mts`.
  The CommonJS boundary for the pasteable helper remains separate from the ESM test config.
- **Resolved:** the Next ESLint plugin initially looked for the app at the repository root.
  `settings.next.rootDir` now names `apps/web/`. The PostCSS default export is named, and the
  retained final lint receipt is clean. The [official monorepo setting](https://nextjs.org/docs/app/api-reference/config/eslint#specifying-a-root-directory-within-a-monorepo)
  was checked during review.
- **FYI:** ESLint 9.39.5 is deprecated. Installed `eslint-plugin-react` 7.37.5 and
  `eslint-plugin-jsx-a11y` 6.10.2 declare peer ranges through ESLint 9; the chosen pin satisfies
  the current complete peer intersection. Next's config itself supports newer ESLint.
  The bounded upgrade review is documented in [toolchain.md](toolchain.md).
- **FYI:** the full native dependency audit reports one high `braces` advisory through the
  Next lint tooling. Production-only audit reports zero findings. The checked-in glob inputs
  are controlled by the repository, and no current runtime route accepts glob input.
  The documented deferral retains the finding and a 2026-10-24 review date; the full audit
  must not be described as clean.
- **FYI:** `check-secrets.mjs` scans Git index content and tracked environment filenames for
  a documented set of patterns. It suppresses matched values and fails on execution errors.
  It does not inspect ignored/untracked files or compressed archives and is not a complete
  credential audit. A final staged-index scan remains part of delivery.

## Review coverage

The source matches M00's placeholder scope. There are no collectors, database migrations,
authentication flows or live provider calls. The environment helper validates on explicit
invocation, refuses browser calls and redacts validation values/custom errors. Slug tests
preserve seed naming rules. Normalizer tests exercise the canonical plain-JS helper,
including missing dates and the Unix epoch. The static server page has semantic landmarks,
an accessible wordmark, noindex metadata and no application data-fetching path.

CI uses pinned Action SHAs, read-only repository permissions, no persisted checkout credentials,
the pinned manager/Node line and frozen installs. Checked-in install policy blocks dependency
lifecycle scripts. Quality, unit, build and browser jobs are wired; database CI remains deferred
to M01. The owner-controlled protection gate is separate from workflow configuration.

## Verification inspected

The integrated implementation receipts were read from this evidence folder: clean frozen
install completed with pnpm 10.34.7; lint, format and strict typecheck passed; all 39 tests in
5 files passed; the production build completed; all four Playwright viewport/axe tests passed.
The final browser receipt after the `agentRules` configuration change reports 4 passed in 16.1s.
These are shared implementation-agent receipts, not a separate rerun of the complete suite.
The development smoke receipt also records HTTP 200, the expected metadata/content and no
browser runtime/console errors or failed requests.

The reviewer independently inspected the desktop and mobile saved screenshots. Both show the
specified white wordmark, black background, uppercase gray label and footer without clipping.
The mobile image is 960 by 2100 device pixels for the 320 by 700 CSS-pixel viewport at DPR 3.

A focused mutation copied the unchanged slug source/tests into an isolated ignored folder,
then removed only the ampersand-to-`and` replacement in that copy. The existing suite rejected
it with three failures out of 14 tests and exit code 1: two CSV ampersand cases and the
unspaced ampersand case. See [review-mutation.log](review-mutation.log). Implementation source
and the Git index were never modified by this experiment.

Automatic approval review rejected recursive cleanup of the verified review-owned
`D:\Everyone\everyone Market Research\everyone-market-radar\.m00-clean-review-mutation`
as blocked by policy. The three-file ignored scratch folder is retained; no alternative cleanup
command was attempted. This retained review scratch is not a task blocker.
