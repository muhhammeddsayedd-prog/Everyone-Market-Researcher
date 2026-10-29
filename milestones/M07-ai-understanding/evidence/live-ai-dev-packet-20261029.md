# M07 next bounded real-model dev validation

Status: **owner-authorized; hosted validation in progress, not complete.** Accepted application head `795c3556928f756c146406d415e95ebc5b2473d0`, branch `m07-ai-understanding`; [CI40913235591](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/40913235591) passed all five required jobs and is reused. Actual two-file dev migration and price/advisor preflight succeeded. Native workflow save exposed a concrete connection-shape defect before any model start; corrected-code qualification and remaining live proof stay open. [Current actual evidence](live-ai-dev-20261029.md) / [machine record](live-ai-dev-20261029.json). This packet remains the already-authorized one-item text/embedding scope; no new general approval is needed after repair/reconciliation. It does not claim model accuracy or full M07 acceptance.

## 1. Targets and pending definitions

- Project: emr-dev / `zmotjsbzhzjvpelxvxlf`; session pooler `aws-1-eu-central-1.pooler.supabase.com:5432`, database postgres. Runtime login is `n8n_writer.zmotjsbzhzjvpelxvxlf`, max pool1, strict pinned CA verification.
- Read current hosted migration history before any write. Last owner-accepted hosted baseline is24; current actual history is deliberately unverified in this local slice. Pending expected versions: `20261029143813_m07_ai.sql` and `20261029154649_m07_embeddings.sql`. Exact hashes are in the companion local evidence JSON. If a reviewed version is already applied identically, record and skip it, then dry-run only the still-pending reviewed subset. Stop on unknown or divergent history; do not replay a successful operation. Use the existing bounded administrative path for the exact two-file dry run/push and readbacks only. No seed.sql, reset or production access.
- Source application head/CI, native definition hashes, exact deployment ID/URL and exact selected UUIDs must be recorded at admission. A mutable branch alias is insufficient.

## 2. Exact preflight selection

Read-only select at most one existing active, nonduplicate dev item, whose competitor is an existing approved pilot and whose source run is terminal. Prefer a Vimeo or Instagram-post item from Everyone or Good People with public text, `ai_status=pending`, no human AI-field locks, an existing visible ai_extract message and no unsettled AI attempt. Exclude C999, story/campaign observations, removed/duplicate items and unrelated work. Order by competitor company_code, item.published_at DESC NULLS LAST, item.id, queue.msg_id. Read original item/lock/AI fields, original queue message and current costs. Source text/caption/credits/markdown must fit a small representative request; compute its actual byte size at preparation rather than asserting token counts from characters.

Freeze the chosen item UUID and its competitor UUID in the admission receipt and the server allowlists. Embed only that item plus its competitor (two vectors); organization support is already locally qualified and is not silently added to this smoke scope. If no such pending item exists, report that exact eligibility fact; do not manufacture content, reset watermarks, drain unrelated work or requeue a completed extraction as new authority. Claims use the implemented selected-claim RPCs and leave unrelated message bodies/read counts/visibility unchanged.

## 3. Provisional model and accounting configuration

These are integration-smoke choices, not the final MA-17 evaluation choice:

| Request | Provisional identity | Public standard USD per1M tokens | Finite settings |
|---|---|---|---|
| Text Responses | gpt-5.4-mini-2026-03-17 | input0.75, cached input0.075, output4.50 | text only; max_output_tokens4096; no tools/stream/store;120s HTTP timeout; one dispatch |
| Embeddings | text-embedding-3-small | input0.02 | float,1536 dims; batch<=4;4096 UTF8 bytes/input,16384 total;120s HTTP timeout; one dispatch |

Official [extraction model](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [embedding model](https://developers.openai.com/api/docs/models/text-embedding-3-small) and [embedding API limits](https://developers.openai.com/api/reference/resources/embeddings/methods/create) were read29October. Current API documentation specifies8192 tokens/input and300000 total; the implementation's smaller byte envelope is a conservative execution bound, not measured usage. Verify account access, returned model identity and applicable current prices (including any regional variation) at live preflight. The deprecated gpt-5-mini snapshot is not chosen for this new smoke test.

Use existing price-book mechanisms to add the exact pinned smoke-model rows if genuinely absent, after preserving prior rows. Prefer `model:input/cached_input/output` for extraction. Embeddings accept an explicit `model:input` row or the existing legacy model SKU; freeze the actual source SKU/unit/rate. Do not overwrite prices for admitted work or invent missing rates.

Target: one Responses request and one embeddings request. A planning example of10000 input/4096 output extraction tokens plus<=8192 embedding input tokens is about USD0.0261, before account variation; actual usage must replace this estimate. Reserve one separately attributable known-failure/fix observation per path if justified (about USD0.0522 total at the same envelope), not an automatic retry. These are estimates/finite controls under standing development authorization, not new owner financial ceilings. Vercel/Supabase/n8n infrastructure charges remain unknown and separately reported.

## 4. Existing bindings and protection access

At later authorized preflight, reuse approved persistent admin/writer credentials and native n8n/OpenAI integration without extracting the native model key. Verify metadata/type/access rather than asking for replacement credentials. Administration stays in a bounded separate child; n8n/web receive only their application credentials.

Create only owned temporary M07 workflow/Machine bindings, preserving encrypted private rollback copies and exact version readbacks. Do not modify campaign workflows or shared OpenAI credentials. Bind the two maintained native exports to the exact M07 Preview and existing OpenAI native credential; application Machine authentication remains required.

Required server fields are `EMR_M07_GATEWAY_ENABLED`, exact `EMR_M07_DEV_PROJECT_REF`, branch/commit/deployment/audience metadata, `EMR_M07_GATEWAY_TOKEN_SHA256`, restricted `EMR_M07_WRITER_PASSWORD`, exact `EMR_M07_ITEM_IDS` and `EMR_M07_EMBED_ENTITIES`, plus the model/output/batch/byte settings. They target only Preview/m07-ai-understanding. Production targets are forbidden.

Protection must leave the active M06 bypass entirely untouched. Use the supported short-lived same-project development OIDC path in `x-vercel-trusted-oidc-idp-token`, together with a dedicated M07 Machine Bearer, after verifying actual project self-access and token coverage. Current [Trusted Sources docs](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources) allow same-project development-to-Preview by default; actual settings/account support are unverified. Stop if actual self-access broadens the token beyond the intended Preview scope; do not change those rules or substitute the campaign bypass. Deliver only the required short-lived token through an owned private n8n Custom Auth binding, never logs/chat/Git. Do not use `vercel curl` automatic bypass discovery/creation, change Trusted Sources, broaden production access, copy/rotate/revoke the campaign bypass or silently fall back to it. If this independent path is unavailable, stop at that precise access gate and report the supported permission action.

## 5. Native observation, durable proof and repeat

1. Save/read back the exact inactive M07 definitions/bindings; no schedule. Verify target, restricted login, selected-scope bounds and zero conflicting M07 work. Publish no collector/callback or campaign workflow.
2. Run WF-30 once for the selected pending item. Record native execution ID, actual provider response ID/model, immutable attempt/owner/request hash, status and actual token usage. Confirm the durable extraction, unlocked-field changes, preserved locks, credits/reviews, one AI ledger row and one embedding follow-up. Do not claim published/accurate output unless observed.
3. Ensure only the selected item/competitor embedding deliveries exist through the established restricted enqueue contract; any administrative fixture enqueue is explicit and records its message IDs. Do not touch other queues. Run WF-33 once. Record batch/mapping/hash, original vectors,1536 dimensions, actual aggregate usage and exactly one embedding ledger row. Do not invent per-vector usage.
4. Replay the same accepted extraction identity/application and the embedding settlement using its private durable accepted-response projection, with no model node execution. Record unchanged receipt/cost/entity/credit/review/vector counts. If extraction transport is reconstructed from accepted output/metadata, label it a normalized accepted-result replay, not another provider capture. Re-read terminal status and replay ACK safely.
5. Enqueue only the same selected embedding entities again through the scoped existing enqueue path, then run WF-33: model/dimension/input-version/text unchanged must skip without another provider call or cost. Verify unrelated queue rows/read counts/visibility and the generic media backlog are unchanged.

No live access/binding/model behavior above has been observed by this local delivery. Use supported native records plus bounded SQL assertions; do not restart a supervisor or repeat accepted M06 tests.

## 6. Recovery, restoration and retained evidence

Before starting, reserve a complete shutdown interval. Stop new work if identity/binding/request-hash/price/ownership is uncertain, an expected response exceeds its envelope, a model outcome is unknown, or original work remains active. Reconcile the known attempt/batch through durable status, native execution and retained response/usage; an expired lease or missing response never authorizes replacement. A known malformed response records known cost once and stays attributable. An unknown outcome remains explicitly held/unpriced until reconciled; do not describe it as zero cost.

Close owned native executions and database clients. Restore exact inactive definitions and temporary Preview settings/bindings after drift recheck; remove only owned M07 credentials/runtime files and allow the short-lived OIDC token to expire. Retain snapshots, extraction/vector rows, costs, collected rows and sanitized audit evidence. Do not remove migrations or product records to fake restoration. Prove no M07 run/claim/session remains active, or explicitly inventory any held uncertainty. Verify M06's resource/version/bypass identities are unchanged through the already authorized campaign readback, without restarting its observations.

Report actual incremental and cumulative M07 provider usage, prices/unknown invoice charges and separate unknown infrastructure costs. This packet never authorizes production backlog, M05 denied work, vision, Batch, evaluation, email, recurrence or merge. The campaign remains pinned8ba0eb7; new collection stops6November12:00Cairo and resumed cleanup/revocation remains due7November18:00Cairo.

## Authorization recorded and continuation

The owner authorized this exact packet at accepted795c355/CI40913235591. Its access preflight and reviewed migrations have begun; preserve the actual26-version state and current evidence. Repair and qualify the identified native save defect, reconcile/close owned temporary effects, then continue the incomplete same-scope observation, repeats and shutdown. Do not replay migrations or request the same routine setup authorization again. No campaign/bypass change, credential value or financial reapproval is authorized or requested.

## Exact pending migration hashes

| Version | SHA256 |
|---|---|
| 20261029143813 | `66060d4e3078c7ffd822c9719257bfe433ac67b4a5ef23f143c2a04f34ecebb3` |
| 20261029154649 | `29177e7571a42dfe0da8d2a2d265563436a7e5c1b8476b0c9b40dfc5d83628cf` |

## Operation estimate including recovery and shutdown

Target3 native executions: WF-30, WF-33, then WF-33 unchanged repeat;2 initial provider requests. Allow about21 authenticated gateway calls/31 bounded SQL operations for preparation, settlement, original receipt replay, status/ACK repeats and unchanged skip. Plan30-60 n8n management requests and15-30 Vercel environment/deployment/auth reads or owned Preview setup/restoration operations, plus the existing bounded migration/readback commands. Reserve20 further management and20 control operations for reconciliation/shutdown; exact polling and backend calls remain preflight-dependent. Protection-project mutations, campaign mutations and recurring activations are0. These are planning estimates, not renewed owner request-count ceilings. Stop only for a real security/identity/ownership/access/uncertainty/scope boundary, not for exceeding this estimate alone.
