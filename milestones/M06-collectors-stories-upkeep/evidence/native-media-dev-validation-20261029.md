# M06 — one prepared development-validation plan

**Prepared only; not executed or authorized by the current local-only instruction.** This is a side-effect/security review, not another development-budget approval. Standing spending authority remains; estimates guide finite execution and reporting, not arbitrary owner ceilings.

## Exact target and migration

- emr-dev `zmotjsbzhzjvpelxvxlf` only; intended n8n instance `https://muhhammedsayed.app.n8n.cloud`; Everyone Market Researcher Vercel project `prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`, M06 branch Preview only.
- Pending `20261028190835_m06_media_contracts.sql`, SHA256 `9c175f8bfa82f71b61143a5e5e9e52dee5954a89dfab1723737f6206a9e03108`. Six writer-facing media RPCs including the original get/save, four runtime RPCs and a private assertion; no new tables. Generated types SHA256 `36a5b51cf30a79cb70814678ad4c2f6968a0105c21255854903b69adec422415`.
- Fresh history must still contain the exact19 already-applied versions/hashes, with only20 pending. Use the existing bounded administrative credential path and pinned CLI: `supabase migration list --db-url $emrM06DevDbUri`, then `supabase db push --db-url $emrM06DevDbUri --dry-run --skip-vault`, then one `supabase db push --db-url $emrM06DevDbUri --skip-vault --yes` only after the exact match. URI is password-free session-pooler host `aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.zmotjsbzhzjvpelxvxlf`, database postgres, strict certificate/hostname verification with the checked-in public CA. PGPASSWORD exists only inside that bounded database child. No seed flag, reset, fabricated history or migration replay. On ambiguous response, reconcile actual history/schema before any retry.
- Afterward read back versions, ACL/RLS/search_path, generated-type parity and both advisors. Administrative credentials never enter either app route or n8n.

## Deliberate sample and selection

Use **one existing real collected thumbnail**, not a new story/actor capture. Source is the oldest visible media queue entry at admission. Read its exact message/item UUID, competitor code, account/platform/external identity, source presence, human-lock and stored-pointer state before setup. It must belong to the retained M04/M05 real public-content corpus, have an unexpired public image source and no stored/human-locked thumbnail. Record these non-secret IDs in the actual receipt. The historical277-message queue is not a current observation; exact head identity/availability remains unobserved under local-only scope.

This adapter is a bounded FIFO consumer, not an arbitrary per-item selector. Set `EMR_MEDIA_BATCH_SIZE=1`, keep other media consumers quiescent, verify the head immediately before invocation and preserve unrelated rows. Do not drain/reorder unrelated entries or alter visibility merely to reach a preferred account. If the head is C999/test data, missing, locked, already stored or outside the real sample, **stop before claim and report that precise selection boundary**. Do not invent an eligible ID. Do not create fixtures or recapture sources to manufacture one. If naturally eligible, one native run is sufficient.

No story starts, paid source calls, API collection, new content item or seven-day comparison in this packet. Story/no-stories fixtures remain synthetic and T1/AC1/AC3 remain unproved; separate source qualification is later work. No accepted M04/M05 collection is repeated.

## Existing bindings and access preflight

No new input is requested now. Reuse the existing persistent dev writer/Admin/management entries and native Vercel session. Verify only actual readiness in the relevant bounded process at execution time; request MFA or a missing/revoked value only if observed. No general login or credential replacement cycle.

For the exact M06 Preview, temporarily bind only:

| Setting | Required value/purpose |
|---|---|
| `EMR_MEDIA_PROCESS_ENABLED`, `EMR_MEDIA_UPLOAD_ENABLED` | `true`, owned Preview only |
| `EMR_MEDIA_BATCH_SIZE` | `1` for this sample; runtime currently accepts1–5 as a finite operational setting |
| `EMR_MEDIA_COMMIT_SHA` | Actual CI-green reviewed application head; must match native Git/deployment metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | Exact dev URL |
| `EMR_MEDIA_WRITER_PASSWORD` | Existing dev `n8n_writer`; never postgres/api_agent/prod |
| `SUPABASE_SECRET_KEY` | Existing dev Storage signing key; only signing route reads it |
| `INTERNAL_WEBHOOK_SECRET` | Exact matching server-auth secret, reused if privately available and appropriate |
| `EMR_MEDIA_PROTECTION_BYPASS` | Exact owned temporary bypass, used only for same-Preview HEAD/sign requests |

The catalog has no recorded WF-31/media combined credential reference. That is **not proof a credential is absent**. Read only relevant non-secret metadata, reuse a compatible owned `httpCustomAuth` if available, otherwise prepare one dedicated owned media binding holding `x-emr-secret` and `x-vercel-protection-bypass` privately. Do not rename/rotate/extract shared credentials. If a matching app/Storage value is genuinely unavailable, bundle only those missing inputs into one existing private setup; never request them in chat. No production credential belongs here.

Protected Preview access requires the **temporary sole/default automation-bypass exception** for this exact Preview. Its shared default can affect future Production builds while present. That consequence requires explicit approval of this complete plan; it is not inferred from spending authority or local delivery. Preserve application authentication, observe Production build activity before/during/after, issue no Production request/deployment, and revoke immediately on conflict. No plan/account upgrade or billing-control change.

Require supported Node24/Sharp and the300s function duration; no Cloud Code imports or unsupported Edit Image dependency. Save/read back only the owned inactive WF-31 with exact supplied Preview/credential references. Preserve unknown existing definitions rather than overwrite drift. Do not touch shared callbacks/schedules or old M03 error handlers.

## Sequence and assertions

1. Verify immutable source/CI provenance, target/history, absence of unfinished owned work, queue head and bucket `media` configuration. Apply only20 after exact dry-run. Capture baseline item/queue/AI/audit/ledger fields and untouched-source counts.
2. Install the owned temporary bindings/bypass and redeploy only the reviewed branch Preview. Check saved project/branch/deployment/commit and no conflicting Production build. Unauthorized app HEAD must fail; authenticated HEAD must return204. HEAD is presence/auth, not Storage authentication. A single private signed-URL request for the **selected canonical path** verifies the real SDK/key response before queue admission; discard that unused capability without upload or logging it.
3. One deliberate native WF-31 manual execution, still inactive. Capture its execution ID/status and the durable batch receipt. The route must authenticate both native DB principals as n8n_writer through the strict-TLS5432 session pooler, claim exactly the selected head, download a public resolved address, convert real image bytes, obtain the exact capability, PUT immutable JPEG, save exact owner/source/path/dimensions, durably record outcome, then ACK and finish/release the lock. No administrator substitution.
4. Verify one actual Storage object via bounded public read: JPEG, max1280 width, size/dimensions matching guarded metadata and attempted payload accounting. Assert one media asset/pointer change, collected/raw/AI data unchanged, human locks preserved, only owned queue ACK, no extra cost-ledger/AI work. Retain actual byte/status/source limitations; unknown infrastructure charges stay unknown.
5. Replay the **same authenticated request body/execution ID** through the maintained HTTP path using the privately available matching credentials. Expect the original finished receipt and no second claim, CDN GET, signing/PUT, outcome quantity, object or cost. A fresh native execution gets a different ID and is not this replay. Already-saved-pointer/new-message replay is covered locally; do not manufacture a real queue message merely to repeat that branch.
6. Read durable item/message/batch outcomes, actual node status and final principal/lock state. No active owned work or connection/advisory lock may remain. Restore all temporary bindings, revoke and verify absence of the exact owned bypass, leave WF-31 inactive/unbound or at its reviewed saved baseline, and remove only newly owned temporary credential/runtime copies. Persistent originals and collected objects/receipts remain.

## Usage estimate, recovery and shutdown

Estimates are exclusive categories; Vercel is a subset of Management, not added twice. SQL round trips are not API/control requests or SQL statement counts. Internal service calls are included below. No old M03/M04/M05 allowance is reused/reset.

| Category | Planned setup → checks → shutdown | Contingency | Estimated total |
|---|---:|---:|---:|
| n8n Management |13 metadata/save/read/export/status/cleanup |6 recovery/readback |19 |
| Vercel Management |32 bindings, redeploy/readiness, bypass and verified restoration |8 recovery/readback |40 |
| **Management total** |45 |14 |**59, including40 Vercel** |
| App HTTP |8 external plus nested HEAD/sign/process/replay calls |5 diagnostic/recovery |13 |
| Public image source GET |1 |1 alternate only after known pre-PUT failure |2 |
| Storage API |2 capability requests,1 PUT,1 public verification GET |4 bounded reconciliation/alternate reads/writes |8 |
| Runtime SQL round trips |About40 for first run plus same-ID replay |About30 for one established safe alternate |About70; measured, not an owner ceiling |
| Administrative qualification |6 CLI invocations plus about6 readbacks |History/schema reconciliation if ambiguous |CLI may issue multiple internal queries; not falsely precise |

Target is **one image attempt/one object, zero actors**. A single alternate existing eligible queue head is contingency only for a known pre-PUT failure/expired source, after recording the first outcome and rechecking selection. Unknown start/write/completion is never replaced. Once evidence is sufficient, stop optional tests.

Per image: at most5MiB source and2MiB attempted JPEG body; bounded public verification2MiB. Target one each, contingency two. Actor/official collection API cost **USD0**. Vercel compute, Supabase database/Storage/egress and included-quota allocation are **unknown until actual billing/usage readback**, not asserted free or booked as USD0. No invented price-book value. Runtime bounds/retry settings may be adjusted under standing authority for a concrete fix; no routine dollar/count reapproval.

On409/uncertain PUT/save/ACK, retain exact IDs and audit state, stop uploads and reconcile the original object/SQL/queue before any continuation. Do not delete or blindly adopt an orphan, overwrite an object, release another pass's message or falsify a completed receipt. Controlled cancellation may leave durable incomplete/held work; document it and verify physical shutdown rather than report success. Do not deliberately cause a real uncertain write merely to recreate the local negative tests.

Shutdown reserve is included, not optional: readback/close, exact-owned key revocation, env/workflow restoration, private-copy disposal after children close, and retained-evidence inventory. Production, recurrence, notifications/emails, seven-day comparison, website work, PR merge and M07 remain excluded. This plan does not declare M06 complete.
