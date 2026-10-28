# Connected local WF-31 — 29 October 2026

## Preserved checkpoint

`06a1340b5aa648ebff2788573492164fe14d089b`, CI40760521060: all five required jobs and Vercel passed. That result is accepted for local/synthetic behavior. Earlier CI/mock/SET-ROLE failures remain historical, not current prerequisites. M05 selected YouTube/LinkedIn six starts/USD0.28515,19 applied hosted versions and closed runtime are unchanged. Website correction/acceptance and the draft-creation403 remain separate.

## Implemented path

Generated inactive WF-31 uses supported Manual/Execute Workflow triggers, plain JavaScript validation and HTTP Request4.5. It POSTs only the native execution ID to `/api/internal/media/process`. Missing exact Preview/custom-auth references fail before HTTP; the committed unbound definition is explicitly not a native Cloud save. No Sharp, Zod, server imports, image/source data or secrets run in a Cloud Code node. No schedule/error-workflow link was added.

The Vercel Node route authenticates the application secret, exact project/branch/deployment/commit/audience and dev origin. A configured batch size1–5 (default1) bounds work within the existing worker's50-message ceiling. It checks the signing route's authenticated HEAD before opening the writer/claiming data. HEAD proves configured presence/auth only, not actual Supabase key authentication. Only the signing route reads `SUPABASE_SECRET_KEY`.

Concrete path: restricted session-pooler writer → durable queue claim → canonical targets → resolved-public-IP-pinned strict HTTPS download → actual Sharp JPEG → authenticated signing route/SDK → exact single-use signed capability → immutable raw binary PUT → guarded media receipt → durable audit outcome → ownership-checked queue ACK → durable batch finish → confirmed lock/session cleanup. Image bytes remain in the supported Node runtime, not n8n JSON. App headers are sent only to the exact protected Preview, never CDN or Storage.

Transport reuses the existing conservative resolved-address policy. All DNS answers must be public; HTTPS is pinned to the chosen address while preserving hostname/SNI/certificate verification. Redirects, encodings, ambiguous lengths, unsupported images and oversized streams fail closed. Native DNS lookup cannot itself be cancelled by Node; its await is deadline-bounded and late resolution cannot open HTTP. Request/socket closure is awaited. Limits:5MiB source,25M pixels,1280px JPEG/quality80,2MiB output,20s download/PUT,8s signing/readiness,220s worker,250s route plus bounded cleanup,270s n8n HTTP,300s Node function.

## Durable product records and safety

The still-pending CLI-created migration20 is extended with four private writer RPCs (`claim_media_batch`, `record_media_outcome`, `ack_media_batch`, `finish_media_batch`) and one private lock assertion. Existing `ops.audit_log`, queue wrappers and media receipt are reused; no table, credential store or acceptance framework added. Original19 migration files are unchanged.

One fixed session advisory lock is held across serialized short transactions on the strict-TLS session pooler. Native current/session principals must both be `n8n_writer`. Same execution never claims twice. Prior unknown/reconciliation messages are held; complete saved pointers can be safely skipped/ACKed. Record/ACK checks original item/message/read-count/visibility ownership under row locks. Another pass cannot release that claim. Missing outcomes cannot produce completed status. Finish/replay summaries derive from durable receipts.

Audit events store controlled IDs/codes, attempted JPEG body bytes and `cost_usd:null`. Bytes mean payload offered to PUT, not proven wire delivery, stored bytes or invoice quantity after an uncertain response. Duplicated queue messages do not duplicate per-item quantities. Unknown infrastructure cost is not inserted as fictitious USD0 into the numeric cost ledger. Any PUT non-success/conflict/lost response or uncertain save is reconciled rather than retried blindly. Collected content, human locks and existing objects are preserved.

## Actual local checks

- Concrete HTTP transport:63 tests; real Node request construction with DNS/HTTP boundary mocks, including TLS/IP pinning, redirects, header/stream limits, timeout/cancellation, capability identity, raw PUT,409 and lost response.
- Writer adapter:33 tests, including serialization, native identity, fixed lock, replay, stale ownership and rejected/hanging unlock/end. Cleanup failure is503, never success; concurrent close does not release a reused pool client.
- Generated workflow:10 native-code/VM/parameter tests. Supported node schemas/settings checked against pinned official n8n2.43.5 sources. Reference shape is not credential availability or Cloud acceptance.
- Processing/signing route and worker tests cover binding rejection before I/O, private preflight, state validation, cancellation awaiting source closure, immutable/uncertain writes and ACK without another upload. Final focused counts are reported with delivery; overlapping runs are not additive.
- Existing actual SQL integration file now has7 passing gated tests: generated WF-31 code/HTTP expressions → real processing/readiness/signing handlers and SDK → concrete transports → actual Sharp → real restricted SQL adapter/audit/ACK. External DNS/HTTPS/Storage are mocked. Happy result performs one PUT; same-execution replay has no second claim/outcome/cost/image work. A new queue message is untouched by the old execution, then a new execution ACKs its saved pointer without another upload.409, uncertain PUT and wrong capability persist reconciliation/no ACK; subsequent attempts do HEAD only. Unsafe DNS/oversized image persist retryable state/no ACK.
- This SQL fixture simulates session authorization as writer and maps short operation commits to savepoints inside an outer rollback. It is not an actual restricted-login, cross-commit crash-durability, native Cloud or real Storage receipt. Baseline rows/queues/audit/history/roles are verified restored; PostgreSQL sequences may advance and were not reset. Physical test clients close.
- Native NOSUPERUSER PostgreSQL qualification:87/87 pgTAP pass. First local RED exposed an ambiguous ACK loop variable; corrected before GREEN. Latest tests cover finite batch limits, missing outcomes, read-count drift, lock/role restrictions, durable replay and held work. Temporary grants and all six forward definitions roll back; original14-version/10-item/1-company fixture remains unchanged.
- Native20-schema generation/independent AST parity passes; four new runtime RPC types added. Both advisors exit0 with zero findings. Owned60422 qualifier container and scratch removed. The isolated schema/type qualifier's bootstrap superuser context is kept separate from the native privilege tests.
- One composed fixture initially failed503 because its synthetic deployment ID was malformed; the public fixture was corrected. No real credential or hosted call was involved.

Migration SHA256: `9c175f8bfa82f71b61143a5e5e9e52dee5954a89dfab1723737f6206a9e03108`.
Types SHA256: `36a5b51cf30a79cb70814678ad4c2f6968a0105c21255854903b69adec422415`.
The former checkpoint migration hash remains historical; it was never applied to hosted dev. New normal required CI must replay/check this exact candidate before future live use.

## Boundaries and next step

No hosted migration, secret binding, live image/actor/DNS request, Storage upload, workflow save/publication/activation, email, production or merge performed. Persistent dev credentials untouched. Incremental provider spend USD0; shared/local/CI/Preview infrastructure allocation unknown. Current website denial was neither edited nor reproduced elsewhere.

The [single prepared dev-validation plan](native-media-dev-validation-20261029.md) is the next reviewable operation, not execution authority. Real story/no-stories examples and seven-day comparison remain pending. Native adapter work has no website dependency; shared WF-19/SUB/scheduler work waits where M05 is a concrete dependency. M06 stays open.

Primary contracts checked: [Node24 HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html), [Node24 DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Supabase signed upload](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl), [Vercel Node duration](https://vercel.com/docs/functions/configuring-functions/duration). The installed pinned Storage SDK was also checked for actual PUT/path/binary behavior. Current Supabase changelog has no relevant breaking change identified; no package upgrade was made.
