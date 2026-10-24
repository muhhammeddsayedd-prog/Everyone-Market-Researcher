# Manual actions for the owner

Things only the owner (Mohamed) can do: accounts, payments, secrets, approvals. Codex never creates paid accounts, never enters payment details, and never sees raw secrets beyond what the owner pastes into credential stores.

How this works:

1. Each action has an ID (`MA-xx`) and the milestone that needs it.
2. When Codex reaches it, Codex copies it into that milestone's `PROGRESS.md` → "Manual actions needed" and sets the status to Blocked if nothing else can proceed.
3. The owner does it, ticks it in the milestone `PROGRESS.md`, and adds any non-secret value (project ref, URL) there.
4. Secrets go only into approved native stores or the current-user-encrypted dev store below, never into the repo or chat.

## Current M03 checkpoint ? technical15 closed, acceptance open, 24 October 2026

The [actual technical15 receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-reconciliation-20261024.json) preserves the browser-discovery timeout, native1 and every original false acceptance flag. Helper17fdc34 passed all five CI40106094580 jobs and Vercel. The actual Chrome2 WF-00 page and Execute control were read successfully, but context compaction delayed the coordinator response beyond the unchanged60-second fence. The late reply was rejected. Zero new Management, Admin/database, Preview, workflow, provider or actor operations occurred. One Control request was charged: current usage is **524 Management /843 Control /1367 combined /149 Vercel**, actors0/2. The [separate cleanup receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-cleanup-20261024.json) verifies native0, both known processes closed, all ten disposable leaves/active locks absent and four persistent originals plus Machine retained, with no credential-content read or network request. The closed attempt stays closed. The existing guard/native path will continue the still-unused fifth SQL target after local checks, review, sealing and normal CI. Browser observation will immediately precede prepare so its nonce-correlated reply fits the existing fence. No owner input is needed. Production, schedules, external notifications, R2, merge and M04 remain untouched.

## Approved allocation and historical technical13 cleanup

The [actual runtime restoration](../milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json), SHA256 `365c8bb069e6f7246c89261fb543b8fa9dbd8f38587500da64d5f4d38e065946`, completed native0 with 38 Management requests. The owned inactive workflow baseline and original reviewed Machine domain were restored, remote work settled and network/credential children closed. Its separate recovery journal preserves the original38-row technical13 journal and records no pending PUT replay. The original failed preparation and unknown original HTTP acknowledgement remain unchanged. The required 50 discovery reads found no executions across the25 owned workflows; actors remain0.

The [actual fixture archive](../milestones/M03-n8n-foundation/evidence/runtime-restoration-fixture-archive-20261024.json), SHA256 `37c3f0dc518799700cde6c56f18569634c33b919ba26b4bbac1e6d2d09baa656`, authenticated to dev, verified the complete15-version history before the archive and used four bounded database queries without DDL or migration replay. The full four-window family was closed and global work counters were vacant. Only owned C999 changed from active to archived and its account from active to paused; the exact12/13 audit chain remains present. The [final cleanup](../milestones/M03-n8n-foundation/evidence/runtime-restoration-cleanup-20261024.json), SHA256 `50b274b1f6e26d6ba34b602c2cae45136aea19353073d185a1b25ba4b9cc016a`, removed only the residual encrypted bypass after those proof guards. All ten disposable leaves and parent/runtime locks are absent; four persistent encrypted originals and retained Machine custody remain available. Cleanup read no credential contents and made no network request.

The [owned Machine ACL repair](../milestones/M03-n8n-foundation/evidence/runtime-restoration-machine-acl-20261024.json) tightened only the exact retained store and its known children, excluding shared parents and preserving encrypted contents. The existing producer now creates private storage with the shared CurrentUser/SYSTEM helper and refuses an inherited-ACL existing store before decryption. Fixed stage diagnostics preserve raw-error redaction. A separate local DB preflight defect incorrectly treated historical runtime.jsonl as an appendable counted ledger; its correction retains a whole-file hash for that journal and accepts tails only on the four counters actually present in the immutable receipt. Independent native boundary checks pass4/4 and1/1 respectively. These local fixes and actual cleanup do not establish A–D business acceptance.

Final retained usage is **524 Management /841 Control /1365 combined /149 Vercel**, actors0/2 with the unchanged USD2 reserve. The owner approved cumulative ceilings **Management1024 /Vercel224**, retaining every charge and all other limits; the [immutable approval](../milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-restoration-approval-20261024.json) records the exact reply and reviewed packet. The unchanged377-request remaining plan reaches901 Management and193 Vercel, leaving123 Management/31 Vercel recovery reserve; Vercel is included in Management. The existing consumers are being updated for the exact restored baseline and a new dev registration, preserving all four closed predecessors and the original technical13 plan. Source commit `5087d4d93d2f6ffdca0bc0096b365723005446fc` passed all five CI40103108266 jobs and Vercel; integration review, public seals and normal final-head CI remain required before private execution. Fresh native Vercel metadata covers75 minutes and the connected browser renders owned WF-00 without execution. No credential handoff, time-only renewal or other owner input is currently needed. M03 acceptance stays open; production, recurring activity, external notifications, R2, merge and M04 remain untouched.

## Historical technical13 preparation, readback and first restoration refusal

[Technical13](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json), SHA256 `226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983`, ran after helper570fd560 passed all five CI40087410078 jobs and Vercel. Actual dev15 history/catalog, protected Preview, Writer identity and unauthorized rejection passed without migration replay. Machine rebinding and the initial Notify/Error-handler bootstrap writes were verified. Preparation stopped at the second Notify settings save before any execution or actor start. Its original HTTP response/acknowledgement was not retained and remains unknown; the later bounded readback below establishes saved state separately.

The [actual three-GET readback](../milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json), SHA256 `f03218c0f734e81d153b5123a9a8edc662b0dc1796f434e0a352a95c46575bdc`, completed native0 with HTTP200, strict TLS and socket closure for all three fixed requests. Notify matches the intended settings target with its unchanged before-version and remains unpublished; WF-90 matches its expected published state. Machine identity/security metadata and the journaled update version match, with no credential data field or secret output. This supersedes the earlier applied-state-unknown checkpoint without claiming the original PUT acknowledgement or HTTP status was recovered. The diagnostic made no mutation, execution, actor start or new admission.

Actual usage is **486 Management /791 Control /1277 combined /149 Vercel**, actors0. Environment/bypass removal and SQL-window closure are verified; that fourth window stays permanently closed. Runtime baseline restoration, Machine-domain restoration, C999 archive and remote settlement remain pending. Physical children/streams closed, eight disposable acceptance credential files, the diagnostic Management copy and the parent lock are absent, and four persistent originals/Machine remain present. The encrypted residual bypass is deliberately retained for cleanup; its value was not printed. No new acceptance admission is allowed while these residuals remain.

A native-faithful local reproduction established a helper defect: n8n2.43.5 keeps versionId for settings-only writes, while the controller required every save to rotate it. The correction preserves exact fresh graph/settings readback, requires structural saves to rotate and settings-only saves to retain their version. Local41/41 runtime-control cases pass. The original unknown HTTP result is not relabeled as a success. The reviewed restore-only path preserves the old journal and does not replay that PUT. Its [latest actual parent refusal](../milestones/M03-n8n-foundation/evidence/runtime-restoration-local-refusal-20261024.json), SHA256 `5c35ca04aee7e54054b27daac5d81dbb4f662388fe68f7f6b315b82c2876c3c3`, returned native1 with `privateRead:true`, `nativeExit:null` and zero requests before child start; no authentication occurred. The originals were retained and the shared parent lock was deleted. The exact original failure sub-gate remains unestablished. A separate metadata-only check identified a strict-ACL mismatch on the retained Machine directory/file while Management passed; it read no ciphertext and made no network request. Local repair and verification continue. Runtime restoration and the separate bounded C999 archive are not complete. No owner input is currently needed; production, recurring activity, R2, merge and M04 remain untouched.

## Historical technical12 and approved832/176 integration

[Technical12's immutable receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical12-reconciliation-20261024.json) records the actual outcome at helper `640e594`, whose CI40084051613 passed all five jobs and Vercel. The renewed native Vercel session worked. Dev authentication, complete 15-version history and catalog postchecks passed; no migration was replayed. The protected dev Preview and restricted Writer identity/unauthorized-request checks passed. Runtime preparation then stopped after its Machine schema/metadata GETs, before any workflow write, execution or actor start. The precise metadata sub-gate and HTTP result were not retained and remain unknown; this is not evidence of a missing or rejected credential.

Restore verified the inactive definitions, temporary environment/bypass removal, SQL-window closure, C999 archive and remote settlement. Source/wrapper/credential children and streams closed; all ten disposable/lock leaves are absent. Four persistent encrypted originals and retained Machine custody remain present. The failed Prepare/native1 remains preserved; successful cleanup is not completed A–D acceptance. The `eda4…` SQL window is permanently closed and must not be reopened.

The [one-GET Machine diagnostic](../milestones/M03-n8n-foundation/evidence/machine-metadata-readback-20261024.json) is complete: native0, HTTP200, TLS/socket closure verified; identity, type, creation timestamp and security flags match. Only `updatedAt == createdAt` is false. Exact n8n2.43.5 source confirms that this equality is unsupported; it does not establish a manual edit or rejected credential. Current token/domain values were not read. Its disposable Management copy and coordinator lock are absent; the persistent original is retained. The corrected consumer records a qualified current version and compares a second fresh GET immediately before PATCH. A conflict stops before mutation; the same retained custody token and originally reviewed domain remain the intended restoration baseline. The complete affected runtime suite passes109/109; independent review has no P1/P2, and focused review7/7 plus stricter reserve-boundary7/7 pass. Normal exact-head PR CI remains a separate delivery gate, not hosted acceptance.

The owner replied **Approve Management832 and Vercel176; retain all charges and other limits.** The [immutable approval](../milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-metadata-approval-20261024.json), SHA256 `d5e89e3656f23e3665b2182ef6778f1c3cdd035d8adcc95b0b058f33c203bd83`, makes only that cumulative ceiling change binding. Retain **401 Management /740 Control /1141 combined /114 Vercel** charged, Control2048, combined2560, actors0/2 and the existing USD2 reserve. The strengthened full remaining plan reaches778 Management and158 Vercel;832/176 leave54/18 reserve. The original proposal remains unchanged and is superseded only by the separate approval record.

Reviewed delivery/app source `7b1837201ac7925591577a1517d7288936ca3464` passes all five CI40086177598 jobs and Vercel; PR #8 is OPEN/draft. CI finished after the approval reply and was independently verified before any further hosted operation. The existing consumers now integrate the exact approval, immutable12/diagnostic reconciliation and fresh source-known fourth window. Affected local tests, independent reviews, actual public seal and full native CheckOnly pass without credential reads or network calls; normal new-helper CI is the remaining delivery gate before live admission. The three old SQL windows remain closed; next owner-registration preflight must verify the full closed family, vacancy and retained12 audit before writing. Source-derived admission counts are preconditions for fresh readback, not claims of an already observed post-close query. No migration replay, credential delivery or time-only decision is needed.

No owner action remains for this allowance. Production, recurring activation, R2, merge and M04 remain untouched.

## Historical Management704 delivery — 24 October 2026

**Allowance approved:** the owner replied **Approve Management704; retain all charges and other limits**. The [immutable approval](../milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json) raises only cumulative Management640 to704; retain 288 Management /588 Control /876 combined /79 Vercel, zero actors used and every other limit. No further owner input is required for this decision. Codex is integrating the exact approval into the existing consumer, running affected tests/review/public readiness and normal PR CI before continuing M03 A–D under standing authority. Browser control is separately verified below; persistent credentials remain available.

**Delivered checkpoint:** commit `9d9edf37f310f82647837e5b4cef31876a89b244` is pushed to draft PR #8. CI40082014843 attempt1 passes all five jobs and Vercel. Actual public sealing covers242 project/840 runtime files; full native CheckOnly (`407be2`, native0) reports `check_only_ready`, Management704, Control2048, publicCompositionLoaded/adminPublicInputsVerifiedtrue and privateReadfalse/network0. This is local/public delivery readiness, not a new live admission or A–D acceptance. The existing raw-pipe coordinator's additional synthetic split-frame/overlap/stderr/failure tests pass without real children or credentials. This note is batched into the next meaningful change rather than a CI-announcement-only commit.

**MA-11 native-session restoration complete:** the owner replied **Vercel native session restored**. Fresh native metadata independently verifies `metadata_covers_75_minutes`, metadataValid/unexpired/covers75Minutes/childClosedtrue, zero network/authentication/refresh/config writes. That proves saved-session coverage, not endpoint authentication. All four persistent dev entries remain present; no new credential, native sign-in or allowance input is currently requested.

**Actual technical11 is closed:** [immutable receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json). It made25 saved-definition GETs and50 execution-discovery GETs plus one browser-discovery call, then failed the Admin client's missed704 source/window branch before Admin spawn, decryption or database authentication. No Preview/setup/provision/reactivation, workflow execution or actor start occurred. Raw residual/false closure flags are preserved. Separate local verification proves parent/runtime/descendants absent, all10 disposable leaves removed without credential contents, the released public runtime lock removed, all streams/public receipt closed and persistent originals/Machine retained. Charges are now313 Management /639 Control /952 combined /79 Vercel, actors0. The unchanged376-request remaining plan reaches689/704; no allowance increase or owner action is needed. Codex is fixing the existing client/reconciliation path and adding the missing genuine704 cross-boundary prepare regression before another safe continuation. No migration replay, production, schedules, merge or M04.

**MA-11:** Browser restoration was verified earlier in this session; no credential handoff is needed. Technical 10 authenticated to emr-dev and verified the complete 15-version history, then failed a historical catalog predicate before any Preview, provision/reactivation, workflow execution or actor start. Its [immutable receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical10-reconciliation-20261024.json) preserves the failure and subsequent independent readback/cleanup. Both old windows are closed, the fresh window is absent, C999 remains archived/paused and no active work or collected items exist. All disposable credentials/locks and children are gone; persistent originals remain ready.

**Browser restoration verified at 09:08 UTC, pending the next meaningful delivery batch:** the earlier attempted final tab handoff lost its REPL binding, then exact-tab rebind reported `Debugger unattached`; one tool-session reset did not resolve it. That historical cause remains unestablished. After the owner replied **WF-00 visible; control reconnected**, fresh inventory responded in Chrome Person 1. The old workflow tab was absent, so Codex opened the exact owned URL in a fresh tab (`1091385202`) and read **WF-00 · Orchestrator [dev]**, Personal project `pHvQjDmjxVZ3KQLT`, and the enabled **Execute workflow from Cairo clock** control. No Execute, login, configuration change or new acceptance admission occurred. Browser control is now verified; this is separate from provider authentication and the allowance decision below.

The reviewed delivery is **4b31c5f8447d79418b8572a872a86afd5722244d** on `m03-n8n-foundation`, PR #8 OPEN/draft. CI40055207916 attempt 1 and Vercel all pass; its historical sealed CheckOnly stopped at `management_cap_insufficient` with no private/network access. Both questions presented at that checkpoint are now answered: browser restoration is verified and Management704 is approved above. The ignored runtime receipt `scripts/n8n/out/foundation/live/technical10-delivery-20261024.json` preserves that historical checkpoint. Current source changes receive their own affected tests/review/public checks and normal CI. M03 acceptance remains incomplete.

At the approval checkpoint, charges were **288 Management /588 Control /876 combined /79 Vercel**, actors **0**, and the unchanged remaining plan reached664. Technical11 now retains **313/639/952/79**, with the next conservative Management total689/704 and Vercel123/132. The [reviewed packet](../milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md) remains immutable historical proposal text; the separate approval above makes its exact change binding. Every charge, other ceiling, actor/spending reserve and delivery boundary is retained.

The allowance action is complete. Its recorded approval is followed by tested/reviewed consumer integration and public readiness; approval itself is not A–D acceptance. No password handoff, file edit, new time window, production or merge approval is requested.

The separate browser-control action is complete by actual UI readback. The exact workflow page is retained for the unfinished acceptance work. No further reload, credential handoff, n8n login, Vercel sign-in or MCP setup is currently requested from the owner. Earlier288/588 presentation figures below are historical; the technical11 checkpoint above retains the new313/639 totals.

## Completed M03 access restoration — 24 October 2026

**MA-11:** Implementation head `a3e3451acbb7dff957f4a8f22bd9bc367bd4af79` passed all five CI40047557479 jobs and Vercel. Public reconciliation and the sealed Windows CheckOnly pass. The remaining gate is browser access: the old browser ID is unavailable, and the currently listed Chrome **Person 1** profile times out on tab/session operations. This does not establish that n8n is logged out. No new live window, credential consumption, SQL registration or hosted acceptance action occurred; usage stays 237 Management / 486 Control / 723 combined / 79 Vercel, actors 0.

The owner replied **WF-00 visible; browser control reconnected**. That report is retained, but the subsequent exact WF-00 tab bind and a fresh browser inventory read both timed out before admission. One bounded native details read and one inventory search also returned connector errors. The details error alone may reflect the historical MCP-disabled workflow setting; neither read establishes an authentication failure or a working fallback. No further discovery/login loop is authorized by those errors.

1. Save work, then fully close and reopen Chrome **Person 1**.
2. Restart the Codex client. If Codex runs in VS Code, use **Ctrl+Shift+P → Developer: Reload Window** instead. Reopen this repository and conversation.
3. Open `https://muhhammedsayed.app.n8n.cloud/workflow/MzimjpsuyPuK7SKe`, reconnect the existing browser-control extension/panel if prompted, and leave **WF-00** visible without clicking Execute or changing credentials.
4. Reply **Chrome and Codex reloaded; WF-00 visible**. Expected non-secret result: browser inventory and the exact workflow metadata read respond successfully. A stated reconnection or visible page alone is not a control receipt; Codex must verify actual access before admission.

The owner then replied **Chrome and Codex reloaded; WF-00 visible**. Actual browser inventory now responds, and a fresh owned tab in Chrome Person 1 displays **WF-00 · Orchestrator [dev]**, the Personal project and the whole-workflow Execute control. This verifies browser control and the current signed-in editor, independently of the still-unverified native connector. No Execute was clicked during this access check.

No further owner access action is needed. The exact source allowlist correction passed 13 native tests, independent review, public seal/CheckOnly and all five CI40050661178 jobs plus Vercel at `2c6d952`. The browser later briefly showed Offline/loading and recovered without a restart or settings change. Cloud Admin separately reported Online. Neither that dashboard nor the public strict-TLS/no-HTTP diagnostic proves endpoint authentication.

Actual technical attempt 9 is now closed: [receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json). It completed the browser proof and bounded read-only discovery, then the Admin helper refused at its local public preflight **before password decryption or database authentication**. No Preview setup, SQL provisioning, workflow execution or actor start occurred. Normal closure and subsequent disposable cleanup are verified; all four persistent originals remain present. The raw residual flags are preserved. Codex is diagnosing and repairing the existing helper/recovery path under standing M03 authority; no owner credential, time or general development approval is needed.

Conservative totals include the separate unauthenticated diagnostic: 263 Management / 537 Control / 800 combined, Vercel 79, actors 0. Approved ceilings stay 640 / 2048 / 2560 and Vercel 132, with the original two-start/USD2 reserve. Production, recurring activity, merge and M04 remain untouched.

## Completed M03 decision — request allowances approved, 24 October 2026

**MA-11:** The owner approved the [exact remaining request-allocation packet](../milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-20261024.md) at reviewed head `8ee16f6d05041ee8b8927b95452431f3ccb5643a`, after all five CI40043938844 jobs and Vercel passed. The [immutable approval](../milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-approval-20261024.json) raises only cumulative Management 576 to 640 and the included Vercel sub-pool 88 to 132. All 237 Management / 486 Control / 723 combined / 79 Vercel requests remain charged; the original two-start/USD2 actor reserve is unchanged.

The exact reply was **Approve cumulative Management 640 and Vercel 132; retain all charges and other limits**. No owner reply, command, secret, new credential handoff or time-only decision remains for this gate. Codex must finish the scoped consumer/fresh-window integration, affected checks, independent review, public preflight and normal PR CI before admission. The selected fresh UUID `eda4fae1-1e19-47db-81b8-beac1a4ed883` is approved but not registered; both prior closed rows stay unchanged. Approval is not actual A–D acceptance and includes no production, recurring activity, merge or M04.

All four persistent encrypted dev entries and retained Machine custody are available. The initialization instructions below are historical setup instructions; do not repeat them unless a current Status check identifies a genuinely missing/revoked input.

## Persistent access completed — 23 October 2026

The owner's development-autonomy reset is approved. No replacement-window or
ordinary task approval is needed within the existing M03 scope and cumulative
limits. Temporary-copy consumption/lease expiry does not require another handoff.
Historical instructions below describe earlier checkpoints and are not current
owner requests.

Initial inventory found the store and all four disposable inputs absent. The
owner completed the single setup below; actual Status now verifies all four
persistent entries present with correct ACLs and no missing entries. This is
storage readiness, not endpoint authentication. No credential-delivery action is
pending. The separate security-default exception below is approved. Keep the command below for genuinely missing entries or explicit updates. Existing Machine ciphertext is retained and reused;
shared n8n provider credentials and native GitHub/Vercel/MCP stores are not copied
or recreated. The tested/reviewed missing-only initialization command in Windows PowerShell
under this same Windows account is:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Action Initialize -Kind All
```

Enter saved EXISTING values at the hidden prompts, in order:

1. emr-dev postgres database password for `zmotjsbzhzjvpelxvxlf` — bounded Admin path only.
2. n8n Management API key for `muhhammedsayed.app.n8n.cloud` — only identified Market Radar resources.
3. emr-dev `n8n_writer` password saved from M01 — not postgres, `api_agent`, a production password or Supabase Secret key.
4. Same-owner Apify READ token for Actor runs, Datasets and Key-value stores READ — reuse the saved token; do not extract the shared n8n token.

Expected final marker: `M03_DEV_ACCESS_READY`. Close that PowerShell window,
retain your saved originals, and reply **M03 persistent dev access ready**. Send
no values/files/URLs. Initialization saves reusable CurrentUser-DPAPI originals
outside Git with intended-user/SYSTEM ACLs; it does not authenticate or start a
paid call. Later approved consumers automatically create/delete only necessary
disposable copies. No artificial expiry or repeated entry while values remain
valid. Missing-entry status is available through the same command with
`-Action Status -Kind All`; a revoked/expired entry can be replaced using
`-Action Update -Kind <one actual kind>`.

Actual23October coordinator project reads and owned temporary bypass create/
removal succeeded; the second PATCH failed native1. Current official API review
identifies the sole-bypass/default constraint, rather than a saved-credential
rejection. The owner approved the exact consequential project-security-default
exception at reviewed9e7a8be; implementation and verification remain. The bypass was project-wide, may automatically have been
default, and was removed with acknowledged/verified absence; no production
deployment/data/env-target/workflow change is claimed. Four originals remain
ready, disposable inputs/local bypass/lock are gone, no entry/login/time-only
action is needed. [Actual receipt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-persistent-attempt-20261023.json).
Private R2, recurring activity, merge and M04 remain separate.

## MA-11 - temporary security-default exception approved

The actual provider prerequisite requires a sole automation bypass to be the
default. The owner approved the exact
[temporary sole/default exception](../milestones/M03-n8n-foundation/evidence/sole-bypass-scope-decision-20261023.md).
It explains the project-wide credential and default-variable exposure on future
builds, including Production builds started by another actor. Approval permits
only the bounded remaining M03 dev use and cleanup, with all cumulative
limits unchanged. No credential, new time window, production operation or merge
approval is requested. [Approval receipt](../milestones/M03-n8n-foundation/evidence/sole-bypass-scope-approval-20261023.json). The four persistent entries remain ready; no owner action is currently pending.

## MA-02 - cumulative Vercel88/44 approved,23 October2026

The owner replied exactly **Approve cumulative88; keep44 charged**: [immutable allocation approval](../milestones/M03-n8n-foundation/evidence/remaining-control-allocation-approval-20261023.json), referencing the original df4b539 packet. This approves cumulative setup50-to88 while retaining44 already used, with all global/actor/spending limits and prior102/301/403 preserved. No owner reply, login, secret delivery or time-window decision remains for this gate. Codex must verify the scoped implementation and actual readiness before continuing remaining dev A-D; approval alone is not acceptance or permission for production, recurring activity, merge or M04.

## MA-11 - reviewed WF-00 restoration verified,23 October2026

The exact owner-approved inactive definition restoration is complete: [actual verification and cleanup](../milestones/M03-n8n-foundation/evidence/wf00-restore-verified-20261023.json),87a22f/native0. One preserved failed GET plus the successful GET/PUT/GET total4 requests; current102/301/403 and carried Management10 do not replenish any allowance. Exact editable definition, inactive/unpublished ownership and separate native storage invariant pass. Private rollback backups and all four credential originals are retained; metadata-only Status is not every-endpoint authentication. No restore, credential or time owner action remains. The separate cumulative Vercel88/44 decision is now approved as recorded above; full A-D/C01 acceptance, production, merge and M04 are not completed by this restoration.

## Historical M03 owner actions and receipts

**Historical M03 status, 22 October 2026:** fixed-project Vercel access verified.
The owner restored the existing session; bounded saved-file coverage passed
16:39:18.509 UTC. Following independent review/public readiness and source
f4775b2 / CI39818174853 all five jobs plus Vercel, the one-use native GET
f2121a completed17:04:25.170 UTC: HTTP200/native0/all12 project predicates true,
children closed/parent mutex absent. [Actual read](../milestones/M03-n8n-foundation/evidence/dev-acceptance-project-preflight-actual-20261022.json).
MA-02 actual access is verified; no repeat login, key or credential action.
Effective storage backend and earlier lost GET cause remain unestablished.

Totals remain6 management/201 control/207 combined. The owner replied
**Approve exact project-verified packet** at reviewed8eb6e2e / CI39823333289
all five jobs plus Vercel, approving [the exact distinct time/retained-C999 packet](../milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md).
MA-11 decision is complete; do not ask again. [Actual approval](../milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approval-20261022.json)
SHA5eb38cbe is pinned/reviewed; affected21/21 and fresh reviewed-source/CI check
pass. [Approved public readiness](../milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approved-readiness-20261022.json)
also passes: seal92e675 native0/136 project/840 Zod/3462 Vercel, guardbcada2 ready,
coordinatorfad5fc native0 check_only_ready/Admin public inputs true/handoff false,
direct Admin6224f6 native4 PUBLIC_INPUTS_READY. These CheckOnly modes read no
private metadata/DPAPI/auth/network. Normal new-pin delivery CI still remains.

No new clock/admission or owner credential action now. Presence f1ba87 at
18:08:20.5684847 UTC verifies all eight input ciphertext/lease files absent;
pending Machine cipher+metadata present was presence only. Later non-secret
JSON checkf30b9c at18:10:42.2851776 UTC verifies its exact seven-key contract/
original public delivery pins/credential ID; ciphertext unopened, not token or
endpoint authentication proof, no Machine input needed. Parent lock absent;
no ciphertext/lease-content read. Separate saved-auth check7a0943
native0 verifies covers75/child closure with no network/auth/refresh/config writes.
[Exact four-saved-input instructions](../milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-handoff-20261022.md)
are prepared but wait normal new-pin CI and a fresh local saved-auth75 check.
No repeated approval is needed. Prior read fences/windows stay spent;
all14 applied dev migrations/M02 data and historical advisor/type/closure
evidence remain preserved. Production, schedules, private incident execution,
merge/M03 closure and M04 remain excluded.

Both source and final wrapper close receipts were captured; outer native1/EOF
and credential-bearing children closed. All eight consumed handoff leaves and
private SQL scratch are gone. Reviewed exact unused/uninstalled bypass cleanup
29b313 native0 at11:09:58.096 UTC succeeded; presence11:10:53.178 UTC verifies
all inputs/bypass/locks/scratch absent. Saved originals and pending Machine
remain. No writer/admin/management/Apify handoff is requested now.

Actual totals5 management/201 control/206 combined preserve prior155; native/
gateway/provider/actors0. Baseline/window/settlement residual flags remain false;
A–D/full-D is open. Admission10:52:53.414 UTC was used and closed10:57:00.225;
its remaining time is not reusable. No second child/retry/renewal/migration
replay, production, private incident execution, merge or M04.
[Actual attempt and cleanup](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json).

**Historical pre-admission preparation, 22 October 2026:** blocked on MA-04 / MA-11 four saved-value
deliveries; verify normal new-pin CI/Vercel before requesting them. The exact startup-replacement time/
retained-C999 packet is approved at reviewed PR8 head 7262f64; do not repeat the
decision. New clock not started/admission absent. Final approval pin is
**b58581a7622206ba52a35a3c60bc46d7482192640540e3025546f71c31fdc3c3**;
initial 72878e70 is a superseded ASCII projection only. Narrow review c6609f
GREEN verifies exact reply/no BOM/24+39 pins, no P1/P2. Historical actual
metadata-only 2de0da at 09:14:23.1556778 UTC finds Admin cipher+lease present/
valid dev purpose but expired/covers75 false, and Management/Writer/ApifyRead
pairs absent; no decrypt/auth. Cleanup effe3b at 09:16:21.6762115 UTC/native exit 0
removed only expired Admin two leaves; all four pairs now absent, no decrypt/auth.
Final corrected-pin public seal/readiness is complete: seal 144054 native exit 0/
129 project/840 runtime; guard 5ba4cc ready; wrapper 70fc2d native exit 0
check_only_ready/public composition/Admin public inputs true, handoff ready/MCP
port false/privateRead false/network 0. Direct Admin e79df1 explicit native exit 2
HANDOFF_MISSING, no decrypt/auth. Verify this commit's normal PR8 five-job CI/
Vercel before only [the exact four-saved-input handoff](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-handoff-20261022.md).
bf5fd9/a48cad checks pass 18/18/no skips; no future CI result/head claimed.
[Approved preparation evidence](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-approved-readiness-20261022.json)
is complete; clock/admission absent. No new approval/Machine/prod/reset/new key.
Historical
e803 deliveries passed metadata/75-minute coverage
and CheckOnly, then the remaining segment was admitted and consumed. Prepare
blocked after 50 baseline GETs. Native held-open reproduction identifies the
public lock reader's sharing conflict 32; corrected/reviewed locally, with earlier
simultaneous gates unexcluded because raw historical diagnostics were lost.
No password rejection or new authentication is claimed. Cleanup fd3fa5/native
exit 0 deleted nine leaves; a3c6aa verifies all absent and Admin two files
preserved. Local repair and cleanup are delivered. All one-use admissions are
consumed. A distinct concrete startup-replacement
packet/checkpoint and purpose-bound consumer/guard is implemented and freshly
reviewed, no actionable P1/P2. Its preapproval public readiness passed, then owner
approved at 7262f6459e2b04713dda8d2912970c496585b4f3 after CI39696952040 five jobs/
Vercel verified ef71fc. No future CI result/head or handoff readiness claimed.
No credential action now. Preserve 155 used requests, 14 records,
old admissions and current cleanup. Do not retry the spent consumer.
Prior delivery commands are historical, not a request to run them again.
Actual A–D/full-D acceptance remains open. Production, private incident R2
execution, PR8 merge and M04 remain unstarted. [Actual attempt](../milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-attempt-20261022.json),
[verified cleanup](../milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-cleanup-20261022.json),
[startup repair](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-repair-20261022.md).

Public-only receipts: seal 4f0f07 native exit 0/129 project/840 runtime files;
direct guard b7af95 native exit 0 approval_required; wrapper c83748 native exit 0,
privateRead false/network 0/Admin public inputs false; Admin a7770c explicit native
exit 3 APPROVAL_REQUIRED before private metadata/authentication. All 39 disk/
37 indexed pins and 24 historical/11 tracked records verified, 14 records unchanged.
[Actual readiness](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-readiness-20261022.json).

**MA-11 complete; do not request the decision again:** owner approved
[the exact packet](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-packet-20261022.md)
at reviewed [PR8](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/8)
head 7262f6459e2b04713dda8d2912970c496585b4f3. The
[immutable approval](../milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-approval-20261022.json)
records the actual reply below, not an authentication/live-pass receipt. New
clock not started and no new admission; no credential action yet. Actual reply:

**Approve one M03 A–D startup-replacement dev window and exact retained-C999
reactivation at the reviewed PR #8 head, preserving all prior attempts and
aggregate caps; no migration replay.**

| ID    | Milestone                      | Action                                                             | Steps                                                                                                                                                                                                                                                                                                                                                                   | Done when                                                                                                                                                                               |
| ----- | ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MA-01 | M00                            | Give Codex repo access                                             | Make sure Codex can push branches and open PRs to `muhhammeddsayedd-prog/Everyone-Market-Researcher`. Enable branch protection on `main` (PR required, CI must pass).                                                                                                                                                                                                   | Codex pushes `m00-bootstrap`                                                                                                                                                            |
| MA-02 | M03 actual access verified | No repeat login or values | Fixed-project native GET f2121a at17:04:25.170 UTC passed HTTP200/native0/all12 predicates, children closed; source f4775b2 / CI39818174853 all5/Vercel. Backend and historical failure cause remain unestablished. | Complete for this observation; no owner action. All old windows/read fences remain spent. |
| MA-03 | M01                            | Create Supabase projects                                           | Supabase → New project `emr-dev` and `emr-prod` (Pro, same region, strong DB passwords saved in your password manager). Send Codex the two **project refs** (not passwords).                                                                                                                                                                                            | Refs in M01 PROGRESS                                                                                                                                                                    |
| MA-04 | M03 persistent dev access | Initialize only genuinely missing existing Admin input once | Use the single current initialization above; Admin stays in its separate bounded DB consumer, with no migration replay. Prior authentication/history14/cleanup receipts remain historical. | Local store ready plus actual bounded access separately verified; no recurring handoff. |
| MA-05 | M01                            | Set machine role passwords                                         | After Codex's M01 migration runs: in each project's SQL editor run `alter role n8n_writer password '<gen>';` and `alter role api_agent password '<gen>';` (generate with `openssl rand -base64 32`). Keep them for MA-11 and MA-20.                                                                                                                                     | Codex test connection succeeds                                                                                                                                                          |
| MA-06 | M01                            | Google sign-in                                                     | Google Cloud → APIs & Services → OAuth consent (Internal if Workspace) → Credentials → OAuth client (Web) with redirect `https://<dev-ref>.supabase.co/auth/v1/callback` (and prod). Supabase → Authentication → Providers → Google → paste the client ID and secret.                                                                                                   | Test login on dev works (M09)                                                                                                                                                           |
| MA-07 | M02                            | Vimeo token                                                        | developer.vimeo.com → Create app → Generate an access token, scope **Public** only. Store as `VIMEO_TOKEN` locally for the resolve script and later in n8n (MA-11).                                                                                                                                                                                                     | Resolve script resolves Vimeo IDs                                                                                                                                                       |
| MA-08 | M02                            | YouTube API key                                                    | Google Cloud → enable **YouTube Data API v3** → Credentials → API key → restrict to YouTube Data API v3. Store as `YOUTUBE_API_KEY`.                                                                                                                                                                                                                                    | Resolve script resolves channel IDs                                                                                                                                                     |
| MA-09 | M02                            | Review unresolved accounts                                         | Codex lists accounts it couldn't resolve or that look wrong. Confirm, fix the URL, or mark invalid. Owner18October response: skip the seven reviewed unavailable/unverified YouTube sources; retain23 website flags and accept11 missing-logo initials fallbacks (D-27). Exact dispositions live in M02 evidence/overrides.                                             | Dev decisions supplied; verify exact exclusions and eligible coverage, preserving raw counts. Production/merge approvals remain separate.                                               |
| MA-10 | M03                            | Apify plan + existing credential                                   | Scale is already owner-reported. Reuse Personal credential `Apify account` (`apifyApi`) by actual ID; do not recreate/rename/rotate it. M03 authenticated limits metadata GET passed; no actor start.                                                                                                                                                                   | Native reference/access verified; prices/paid run are separate gates                                                                                                                    |
| MA-11 | M03 standing development authority | Single missing-entry setup; no time-only reapproval | Owner23October reset supersedes the disposable-copy/lease approval cycle. Use current initialization above for existing Management/Writer/ApifyRead only when actually missing; Machine/native provider bindings are reused. Reconcile safe continuations with counters preserved. | Actual A–D acceptance, retention/settlement/cleanup evidence and separate merge decision; no production, recurring activity or M04. |
| MA-12 | M03                            | Existing OpenAI credential + limits                                | Owner authorized the existing native `OpenAI account`; Models metadata GET passed. Do not create/duplicate its key. Actual project spend cap remains unverified; no inference/embeddings. Vercel/model integrations remain later milestones.                                                                                                                            | Saved reuse/access verified; cap is separate from authentication                                                                                                                        |
| MA-13 | M03                            | Daily alert budget                                                 | Retain Q-07 USD25/day steady-state alert default after owner deprioritized fee reporting. Unknown subscription fees remain unknown. Do not alter shared service budgets or restart the questionnaire.                                                                                                                                                                   | Verified dev budget25 after the exact approved migration; production unchanged                                                                                                          |
| MA-14 | M04                            | Approve backfill estimate (Vimeo + IG)                             | Codex posts the estimated items and cost for the pilot backfill. Reply "approved" in PROGRESS.                                                                                                                                                                                                                                                                          | Approved                                                                                                                                                                                |
| MA-15 | M05                            | Firecrawl key + approve backfill estimate (web, YouTube, LinkedIn) | Create a Firecrawl key; add it to n8n. Approve the estimate.                                                                                                                                                                                                                                                                                                            | Approved                                                                                                                                                                                |
| MA-16 | M06                            | Approve the stories actor                                          | Review the bake-off table (coverage, cost, no login) and pick the primary actor.                                                                                                                                                                                                                                                                                        | Choice recorded                                                                                                                                                                         |
| MA-17 | M07                            | Eval labels + model choice                                         | Review the 200-item eval sheet Codex pre-labels (fix wrong brands/houses). Approve the extraction model.                                                                                                                                                                                                                                                                | Eval locked; model in DECISIONS                                                                                                                                                         |
| MA-18 | M08                            | Approve pilot start                                                | Confirm that daily schedules for the 50 + baseline go live in prod. Pilot day 1 = that date.                                                                                                                                                                                                                                                                            | Date recorded                                                                                                                                                                           |
| MA-19 | M09                            | Auth URLs + first users                                            | Supabase → Auth → URL configuration: Site URL + redirect URLs (localhost, Vercel preview pattern, prod domain). Invite yourself and 2–3 testers in the app (or Codex seeds `member_invites`).                                                                                                                                                                           | You can sign in                                                                                                                                                                         |
| MA-20 | M06 / M09 / M11 / M14          | Vercel env vars                                                    | Add the variables from `docs/ENVIRONMENT.md` §2 (Vercel) for Preview (dev) and Production (prod).                                                                                                                                                                                                                                                                       | Build passes with env                                                                                                                                                                   |
| MA-21 | M11                            | Admin acceptance                                                   | Walk through review + admin flows with Codex's checklist; note issues.                                                                                                                                                                                                                                                                                                  | Checklist signed                                                                                                                                                                        |
| MA-22 | M12                            | Pilot go/no-go                                                     | Read the pilot report (accuracy, cost, forecast, actor results). Approve the threshold and scale-up plan, or ask for fixes.                                                                                                                                                                                                                                             | Decision in DECISIONS.md                                                                                                                                                                |
| MA-23 | M13                            | Email provider                                                     | Choose Resend (create account, verify the sending domain DNS: SPF/DKIM) or SMTP. Add the credential in n8n. Confirm the recipient list (default mohamed.abdelrahman@everyone.film).                                                                                                                                                                                     | Test email received                                                                                                                                                                     |
| MA-24 | M13                            | SerpAPI plan                                                       | Create a SerpAPI account, pick a plan for ~600 searches/month at full scale, and add the key to n8n.                                                                                                                                                                                                                                                                    | Key works                                                                                                                                                                               |
| MA-25 | M14                            | First API keys + MCP                                               | In Admin → API keys create a key for Claude/Codex; add the MCP server URL + header to your Claude/Codex config.                                                                                                                                                                                                                                                         | Agent lists tools                                                                                                                                                                       |
| MA-26 | M15                            | Approve scale-up waves                                             | Approve wave sizes and timing (e.g., +80 next-wave per day) and the backfill cost.                                                                                                                                                                                                                                                                                      | Waves approved                                                                                                                                                                          |
| MA-27 | M15                            | Production domain (optional)                                       | Add a domain (e.g. `radar.everyone.film`) in Vercel; update Supabase + Google redirect URLs.                                                                                                                                                                                                                                                                            | Domain live                                                                                                                                                                             |
| MA-28 | M15                            | Security sign-off + onboarding                                     | Review the security checklist results; invite the team with roles.                                                                                                                                                                                                                                                                                                      | Launch                                                                                                                                                                                  |
