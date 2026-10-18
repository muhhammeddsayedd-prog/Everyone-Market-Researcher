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
M03 local contracts add `smoke_website_stub.js` (the approved website crawler's
one-page mapping) and `prepare_ingest_groups.js` (validation, the greater-than-20%
drift rule and 500-item chunks). The website sample is explicitly synthetic.
It does not prove an actor run, current output shape or Cloud execution.
For this bounded M03 mapper, `payload` is a public source snapshot containing
canonical URL, capped markdown and title only. This deliberately minimizes the
generic raw-source contract: request headers/cookies/provider context and raw
query credentials must not enter the database. Later actor mappers retain their
own reviewed contracts. It hashes with SHA256 and fails closed when crypto is
unavailable; actual Cloud capability is still a deployment check.

`@emr/shared` exports the pure `dispatchSlot` / `scheduledSlots` plans for
WF-00. They validate inputs with zod, use Africa/Cairo including seasonal
offsets, keep PM stories/backfill off by default, and return no calls for an
unknown slot. News plans awards with a 30-minute delay. Saturday 04:00 returns
both LinkedIn and removal slots from one clock event; a later adapter must not
install duplicate 04:00 trigger rules that each dispatch both. These plans
perform no external actions and currently accept development only.

## Development workflow contract

Names are `WF-XX · Name [dev]` and `SUB · Name [dev]`; tags include `env:dev`,
the appropriate `layer:*`, and `platform:*` where relevant. Set each workflow's
timezone to Africa/Cairo. Route errors to WF-90 except WF-90 itself. Use
parameterized Postgres queries (`$1`, `$2`, Query Parameters), never string
interpolation or table-write nodes. Only `Supabase Postgres · n8n_writer · dev`
may call pipeline RPCs. Supabase secret/admin credentials are not substitutes.

Use credential references only. HTTP timeout is 60 seconds, OpenAI 120 seconds;
node retry defaults are three attempts / five seconds, with 429 backoff thirty
seconds. The intended workflow timeout is fifteen minutes **only if the actual
Cloud plan supports it**. Set Config contains non-secret env/app/webhook URLs
when Variables are unavailable. Never put keys in Set/Code nodes or exports.

Import SUB workflows first, then WF-90, callback/health/stubs, and WF-00 last.
WF-00 remains unpublished/inactive throughout M03. No production copy is made
until M08. Unpin test data before exporting; preserve safe credential references
and actual workflow IDs. Every changed hosted workflow must have a sanitized
export under `workflows/`. There are no verified M03 hosted exports yet: access
and live node schemas remain gates, so speculative JSON is not committed as an
actual export.

## Callback safety

Use verification option (b): the callback supplies a run-ID hint only. Look up
its registered context and re-fetch the final actor run using `Apify API`.
Compare its identity/actor and use that response's status, default dataset and
usage. Never trust callback `emr`, dataset, actor or usage fields. Unknown IDs
must not cause dataset reads, registration or actor launches.

The original handoff marked a run processed before ingestion. M03's reviewed
correction requires one atomic database transaction for the bounded one-page
website branch: ingest/report/cost, saved receipt, completion and finish. A
replay returns its saved counts without another insert, queue send or charge.
The migration/hosted acceptance gates for this contract remain in M03 progress.
Separate Postgres nodes with an early or late processed flag do not provide
that guarantee. Other actor branches and multiple actor registrations fail
closed until their later milestones add durable chunk/dispatch barriers.

After registering the original actor-start response, reconcile that same known
run independently of webhook delivery. This covers a callback arriving before
registration or a failure after an immediate HTTP200. An ambiguous actor-start
response must be reconciled before any launch retry. Retryable callback errors
must not terminally fail the parent; put its ID in diagnostic metadata rather
than the terminal error-handler `run_id` field. Log-only notification is the
default; a first-transition flag does not guarantee external delivery.

WF-90 must pass fixed classified error codes and workflow/execution/node IDs.
Raw HTTP/SQL errors and stacks can contain credentials and must not be persisted
or forwarded. The M03 logger uses safe summaries and optional UUID correlation,
superseding the draft's raw-stack storage. Diagnose private raw executions in
the n8n editor when necessary.

See [M03 tests](tests/README.md), [the callback review](../milestones/M03-n8n-foundation/evidence/callback-review-20261018.md)
and [M03 progress](../milestones/M03-n8n-foundation/PROGRESS.md) for exact gates.

From the repository root, run `pnpm test --project normalizers` for the helper
tests or `pnpm test` for all test projects. These checks prove local helper
behavior; hosted workflow acceptance is recorded in the relevant milestone.
