# n8n workflows and normalizers

M03 adds the development workflow foundation after the connected n8n Cloud
runtime and supported node versions are verified. Export each changed workflow
to `workflows/` without credentials. Schedules and paid runs require the
milestone's existing owner approval.

M00 provides the canonical plain JavaScript helpers in
`normalizers/_common.js`, copied from `docs/N8N_WORKFLOWS.md` §7, with Vitest
tests. The guarded CommonJS export supports Node tests; the helper definitions
can be pasted into n8n Code nodes. The local `normalizers/package.json` marks
these JavaScript files as CommonJS and is not a pnpm workspace package.

M04–M06 add actor normalizers and captured, anonymized fixtures under
`normalizers/fixtures/<actor>/`. M07 adds the AI prompts under `prompts/`.
There are no active workflows, external calls, credentials or real actor
fixtures in this bootstrap.

From the repository root, run `pnpm test --project normalizers` for the helper
tests or `pnpm test` for all test projects. These checks prove local helper
behavior; hosted workflow acceptance is recorded in the relevant milestone.
