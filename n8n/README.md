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

The current M03 [foundation entry point](foundation/README.md) uses the fixed,
least-privilege HTTPS gateway source. Actual inactive delivery saved/read back
25 staged definitions under `workflows/`, with real version IDs and safe credential
references. Native Postgres TLS failure remains historical; no native Postgres
fallback, administrator credential or service key was substituted. The new
foundation transport remains disabled and has no admitted runtime window.
Twenty-four canonical error links are explicitly deferred until their WF-90
target can be published under separate live approval. Saved-stage delivery does
not prove native execution, error routing or actor smoke acceptance.

Names are `WF-XX · Name [dev]` and `SUB · Name [dev]`; tags include `env:dev`,
the appropriate `layer:*`, and `platform:*` where relevant. Set each workflow's
timezone to Africa/Cairo. Route errors to WF-90 except WF-90 itself. Use
parameterized Postgres queries (`$1`, `$2`, Query Parameters), never string
interpolation or table-write nodes. Only `Supabase Postgres · n8n_writer · dev`
may call pipeline RPCs. Supabase secret/admin credentials are not substitutes.

Use actual credential IDs and compatible types; logical names do not require
renaming shared credentials. M03 reuses `Apify account` (`apifyApi`) and
`OpenAI account` (`openAiApi`) through HTTP Request Predefined Credential Type,
plus existing Vimeo/YouTube Header Auth. Keep asynchronous actor starts,
callbacks and recovery; the installed native Apify operation's synchronous
default is not a substitute. Never extract a token into a duplicate credential.
The temporary manual-only credential probes are explicitly separate from
foundation workflow/error-routing acceptance. They make no actor/model calls.

Use credential references only. HTTP timeout is 60 seconds, OpenAI 120 seconds;
node retry defaults are three attempts / five seconds, with 429 backoff thirty
seconds. The intended workflow timeout is fifteen minutes **only if the actual
Cloud plan supports it**. Set Config contains non-secret env/app/webhook URLs
when Variables are unavailable. Never put keys in Set/Code nodes or exports.

Import SUB workflows first, then WF-90, callback/health/stubs, and WF-00 last.
WF-00 remains unpublished/inactive throughout M03. No production copy is made
until M08. Unpin test data before exporting; preserve safe credential references
and actual workflow IDs. Every changed hosted workflow must have a sanitized
export under `workflows/`. The25 current actual exports identify
`inactive_native_staging`, intended/staged hashes and each deferred error target;
they are separate from generated canonical source and proposed manual variants.
The actual2.43.5 core-node probe supplies observed versions
and field controls, and was archived without execution. Its sanitized JSON is
capability evidence only. Native blueprints under `foundation/` remain separate
from changed hosted exports and require actual bindings plus deployment checks.

For the bounded foundation acceptance source, fixed HTTPS requests use no
automatic retry,15-second request timeout and a20-second server operation
deadline. Actor launch remains guarded off; its two-run proposal is asynchronous
and has no POST retry. These reviewed limits supersede the generic retry/timeout
defaults above for this finite source profile. All saved workflows are inactive,
unpublished and disable successful/error/manual execution-data and progress
storage. Future dependency publication, canonical error links, manual execution,
runtime rebinding and full cleanup require the separate executable live packet.

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

## GW-01 development connection trial

The approved GW-01 work adds a development-only worker gateway and a separate
inactive native adapter in `foundation/build-worker-rpc.mjs`. It does not
activate foundation workflows or launch actors. The adapter makes one explicit
HTTP attempt using an `httpCustomAuth` credential reference; an ambiguous result
produces a fresh `request.status` descriptor for the original request ID. Status
readback never repeats the business write. The current schema includes immutable
deployment binding in the response window.

[The GW-01 helper instructions](../scripts/n8n/GW01.md) describe the separate
temporary handoffs, privacy gates, one-use delivery receipts, durable trial
counter, direct restricted-writer controls and cleanup. Local tests and inactive
blueprints are preparation evidence; actual Cloud privacy, deployment, restricted
login, trial and cleanup receipts remain separate acceptance requirements.

See [M03 tests](tests/README.md), [the callback review](../milestones/M03-n8n-foundation/evidence/callback-review-20261018.md)
and [M03 progress](../milestones/M03-n8n-foundation/PROGRESS.md) for exact gates.

From the repository root, run `pnpm test --project normalizers` for the helper
tests or `pnpm test` for all test projects. These checks prove local helper
behavior; hosted workflow acceptance is recorded in the relevant milestone.
