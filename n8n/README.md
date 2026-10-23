# n8n workflows and normalizers

M03 adds the development workflow foundation after the connected n8n Cloud
runtime and supported node versions are verified. Export each changed workflow
to `workflows/` without credentials. Reuse the milestone's existing authorization;
new recurring activity or paid scope still requires its separate decision.

The owner's23October development-autonomy reset provides persistent dev access
through the existing Windows DPAPI helper/consumers. Use the single
[initialization/update interface](../docs/ENVIRONMENT.md#persistent-development-access--current-policy-23-october-2026)
only for genuinely missing/revoked entries; encrypted originals persist outside
Git and only disposable copies are cleaned. M03 safe continuations do not need
another human approval solely for an expired local lease/window or tested source
change. One coordinator reconciles previous side effects/closure and carries all
usage forward; never reopen a closed window or blindly repeat an actor start.

The remaining M03 acceptance uses the authenticated n8n browser's whole-workflow
Execute control when the connector returns an error. Browser observations are
explicitly labelled `browser_ui`; they do not supply invented MCP permissions or
version metadata. The existing API reader verifies each saved case's exact
version and graph before a click, then verifies the actual manual execution,
parent/child links, business results, privacy and deletion receipts. Reload the
owned editor after each case save, keep it clean, and stop for any save/conflict
prompt. Never use Execute step or publish a schedule for a manual test.

Each browser start has one durable intent and one click. Its acknowledgement
must contain the native execution URL for that owned workflow. A lost or
ambiguous acknowledgement stays unresolved until actual execution state is
reconciled; do not click again. Browser interaction is bounded to60 seconds per
port call within the existing hard deadline. Ordinary API calls and the MCP
path retain their existing15-second bounds and assertions.

For URL correlation, first verify a freshly loaded, unfiltered execution list
is empty with no active execution. After the one click, require exactly one
new execution card, open that card's actual link and capture the resulting URL.
Zero or multiple cards leave the start unresolved. An automatically selected
latest execution is not an acknowledgement.

The [browser-port readiness receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-browser-port-readiness-20261023.json)
records the closed connector attempt, implementation checks and separate live
acceptance boundary.

The Windows wrapper installs a larger process-local standard-input reader before
its first console read. This prevents the default console reader from truncating
long public JSON acknowledgements at254 characters. Existing protocol length,
deadline, identity and schema checks still apply; Windows console modes and
security settings are unchanged. The fix is verified through the actual Windows
terminal with synthetic public data before development credentials are reused.

On 24 October Cairo, the renewed Vercel session passed its 75-minute metadata
check, then technical attempt 6 accepted the browser acknowledgement and verified all 25
saved definitions. It stopped during WF-70 execution-history discovery before
Admin, database, Preview or workflow writes. The original Reader code/status
was not retained. [The immutable reconciliation](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json)
preserves that partial result, 152 management / 382 control charges and separate
verified disposable-input cleanup. It does not establish A-D or full D.
The Reader now retains fixed error classification, and the public wrapper
forwards only its allowlisted code, owned key, stage and actual HTTP status.
The unchanged 512 management ceiling blocks a 528-request remaining plan before
new admission or private inputs; [the separate allowance proposal](../milestones/M03-n8n-foundation/evidence/remaining-management-allocation-20261024.md)
does not itself increase that ceiling. Persistent originals remain reusable.
The subsequent [WF-70 readback](../milestones/M03-n8n-foundation/evidence/dev-acceptance-wf70-readback-20261024.json)
completed two strict-TLS GETs with HTTP 200 and zero rows. Current charges are 152
management / 384 control / 536 combined; the diagnostic child and disposable key
copy are closed/removed. That current success does not establish the original
failure's cause, adoption, drain or M03 business acceptance.

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
target can be published through the already-approved bounded live acceptance.
Saved-stage delivery does
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
runtime rebinding and full cleanup follow the approved executable live packet
under standing M03 authority, with cumulative limits and actual gates preserved.

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

## Historical GW-01 development connection trial — closed

The completed GW-01 work added a development-only worker gateway and a separate
inactive native adapter in `foundation/build-worker-rpc.mjs`. It does not
activate foundation workflows or launch actors. The adapter makes one explicit
HTTP attempt using an `httpCustomAuth` credential reference; an ambiguous result
produces a fresh `request.status` descriptor for the original request ID. Status
readback never repeats the business write. The current schema includes immutable
deployment binding in the response window.

[The historical GW-01 helper instructions](../scripts/n8n/GW01.md) record its
temporary handoffs, privacy gates, one-use receipts, counters and cleanup; they
are not a request to recreate handoffs or reopen the trial. Its actual closed
trial receipts stay separate from the still-open full M03 A–D acceptance.

See [M03 tests](tests/README.md), [the callback review](../milestones/M03-n8n-foundation/evidence/callback-review-20261018.md)
and [M03 progress](../milestones/M03-n8n-foundation/PROGRESS.md) for exact gates.

From the repository root, run `pnpm test --project normalizers` for the helper
tests or `pnpm test` for all test projects. These checks prove local helper
behavior; hosted workflow acceptance is recorded in the relevant milestone.
