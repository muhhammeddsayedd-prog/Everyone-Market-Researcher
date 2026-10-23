# Manual actions for the owner

Things only the owner (Mohamed) can do: accounts, payments, secrets, approvals. Codex never creates paid accounts, never enters payment details, and never sees raw secrets beyond what the owner pastes into credential stores.

How this works:

1. Each action has an ID (`MA-xx`) and the milestone that needs it.
2. When Codex reaches it, Codex copies it into that milestone's `PROGRESS.md` → "Manual actions needed" and sets the status to Blocked if nothing else can proceed.
3. The owner does it, ticks it in the milestone `PROGRESS.md`, and adds any non-secret value (project ref, URL) there.
4. Secrets go only into approved native stores or the current-user-encrypted dev store below, never into the repo or chat.

## Current M03 action — persistent access, 23 October 2026

The owner's development-autonomy reset is approved. No replacement-window or
ordinary task approval is needed within the existing M03 scope and cumulative
limits. Temporary-copy consumption/lease expiry does not require another handoff.
Historical instructions below describe earlier checkpoints and are not current
owner requests.

Initial inventory found the store and all four disposable inputs absent. The
owner completed the single setup below; actual Status now verifies all four
persistent entries present with correct ACLs and no missing entries. This is
storage readiness, not endpoint authentication. No development owner action is
pending. Keep the command below for genuinely missing entries or explicit updates. Existing Machine ciphertext is retained and reused;
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

Current Vercel saved-file metadata covers the technical 75-minute floor after
the supported native CLI session path; no owner login is currently justified.
The CLI `whoami` result itself was not recovered, so no authentication pass is
claimed. Remote project access remains the dated observation pending the actual
coordinator. No enforced permission/settings change is needed: installed Codex
is0.162.0-alpha.17.2 and the host already supplies workspace/network access.
Production, private R2, recurring activity, merge and M04 remain separate.

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
