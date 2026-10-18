# M02 owner-run seed tools

These tools import the approved competitor CSVs, resolve public account IDs,
check public website reachability and copy bounded logos. They do not collect
content, start n8n, enable schedules or begin M03. Production is rejected by the
current runtime; M01 production approval does not approve M02 production seeding.

The only hosted target currently accepted is **emr-dev**, project
`zmotjsbzhzjvpelxvxlf`. Its owner database connection uses the verified Frankfurt
session pooler `aws-1-eu-central-1.pooler.supabase.com:5432`, database `postgres`,
login `postgres.zmotjsbzhzjvpelxvxlf` and verified TLS. The URI contains no password.
Restricted `n8n_writer`/`api_agent` credentials cannot perform this owner seed.

The initial approved dev batch has already run. **Do not run `accept-dev`, seed,
websites or logos again.** Its successful effects remain in dev; its original
native1 report failure and the separate successful report recovery are retained
in the milestone evidence. All four original handoffs were consumed/deleted.
The reviewed `resolve` continuation has also completed native0:121/128 YouTube
accounts resolved, zero pending and seven failed/invalid; pilot10/11 with C283
remaining. Its Database+YouTube handoffs were deleted and the child closed.
**Do not run resolve or replenish credentials again.** The permanent admissions
are retained. Next is [MA-09 owner review](../../milestones/M02-seed-data/evidence/ma09-owner-review-20261018.md);
any approved correction needs its own reviewed bounded continuation.

TLS uses the public Supabase root certificate in `certs/supabase-root-2021.crt`,
with its official source and public SHA256 in `certs/supabase-root-2021.json`.
Both files are included in the source seal. This CA is scoped to the dev database
client: certificate-chain and exact hostname verification remain enabled. No
Windows/global trust setting or server SSL setting is changed. The `.crt` file
is stored byte-for-byte so checkout line endings cannot invalidate its public pin.

## Inputs and local checks

- `data/competitors.csv`: 285 competitors, including the C000 baseline; tiers
  pilot 50, next wave 174, adjacent 60 and baseline 1.
- `data/competitor_accounts.csv`: 1,272 primary rows. The planner derives 256
  Instagram stories and 226 LinkedIn employees rows, for 1,754 account rows.
- `reference/taxonomies.json`: category/capability codes.
- `scripts/seed/overrides.csv`: committed owner corrections, with headers
  `company_id,platform,url,action`; action is `replace`, `invalid` or `add`.
- `assets/brand/everyone-logotype.svg`: C000's source; it is not a remote download.

No reference-only platform becomes a tracked account. `data/test_accounts.csv`,
test fixtures, C999/test-house and later-milestone data are excluded from the
runtime seed. Tests use local fixtures or rollback-only local database checks;
their results do not establish hosted/provider acceptance.

From the repository root, in a process without credentials:

```powershell
corepack pnpm --filter @emr/scripts seed:plan
corepack pnpm --filter @emr/scripts test
corepack pnpm --filter @emr/scripts typecheck
corepack pnpm --filter @emr/scripts seed:build
```

`seed:plan` is local-only. `seed:build` produces
`scripts/seed/out/runner.mjs` and `runner-seal.json`; its non-secret success result
is `M02 plain-Node runner built and source-sealed. No credentials loaded.`
The build refuses credential-bearing environment variables. Do not run package
managers, installers, compilers or tests with the dev password/provider keys.
Encrypted handoff files do not need to be decrypted to build.

The approved private runtime is the prebuilt plain-Node artifact started by the
bounded PowerShell consumer below. Its reviewed handoff flow supplies live
credentials without putting them in the caller's environment. The `seed:dev`,
`resolve:dev`, `websites:dev`, `logos:dev` and `report:dev` aliases also target the
prebuilt artifact; the Windows private handoff uses the consumer directly.

## Exact private owner setup

Reuse valid existing credentials. Do not reset passwords, rotate valid keys or
create another MCP login for this task. Keep the originals in your password
manager for later integration setup; send no values, URLs or file contents in
chat. No `.env`, Git/config entry, password-bearing URI or secret command argument
is needed.

1. **Dev database password:** open your password manager and locate the existing
   **emr-dev** database password saved when that project was created. This is the
   password for project `zmotjsbzhzjvpelxvxlf`, not emr-prod and not either machine
   role. A new M02 encrypted temporary handoff is used; M01's deleted handoffs stay
   deleted.
2. **MA-07 Vimeo:** open [Vimeo apps](https://developer.vimeo.com/apps), select the
   intended developer app (or create an app if none exists), then open
   **Authentication → Generate an access token**. Use **Public** scope only. Keep
   private/edit/upload and other scopes unselected. Save the token privately.
   Expected non-secret state: the intended app has a public-only access token;
   actual authorization is established later by the public-account probe.
3. **MA-08 YouTube:** in [Google Cloud Console](https://console.cloud.google.com/),
   select the intended Market Radar project. Open **APIs & Services → Library →
   YouTube Data API v3 → Enable** if it is not already enabled. Then open
   **APIs & Services → Credentials → Create credentials → API key**, or select
   your existing suitable key. Under **API restrictions**, choose **Restrict key**,
   select **YouTube Data API v3** and save. Preserve suitable existing client
   restrictions; a server-side call must satisfy them. Do not weaken unrelated
   keys or configure this as a browser-referrer key for the local Node runner.
   Expected non-secret state: YouTube Data API v3 is enabled and the selected key
   is restricted to it. Save the key privately; the probe tests actual access.
4. **Dev Storage key:** in [Supabase emr-dev](https://supabase.com/dashboard/project/zmotjsbzhzjvpelxvxlf),
   open **Project Settings → API Keys → Secret keys**. Privately copy an existing
   valid secret key for **this dev project**. It is used only by the owner-run logo
   upload stage. Do not copy a prod key, publishable key or machine-role password.
   Expected non-secret state: the selected project is emr-dev and its secret key
   is available in your private password manager; no credential is shown here.

After the credential-free runner build, open **Windows PowerShell under the same
Windows account as Codex** and run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind All
```

Enter these four values at the hidden prompts, in order: existing emr-dev database
password, public-only Vimeo token, restricted YouTube key and emr-dev secret key.
The helper writes Windows DPAPI ciphertext under `%LOCALAPPDATA%\Temp`:

| Kind       | Exact encrypted filename        |
| ---------- | ------------------------------- |
| `Database` | `emr-m02-dev-db-password.dpapi` |
| `Vimeo`    | `emr-m02-vimeo-token.dpapi`     |
| `YouTube`  | `emr-m02-youtube-api-key.dpapi` |
| `Storage`  | `emr-m02-dev-storage-key.dpapi` |

Each saved entry prints `M02 encrypted handoff saved: <filename>. Authentication
not tested.` The final line is `M02 encrypted dev handoffs saved: All. Close this
PowerShell window. Keep your separately saved originals.` Close that window and
reply **M02 dev handoffs ready**. This supplies credentials; it does not approve
the bulk packet or prove authentication.

If only one credential is ready or needs replenishing, use the same exact command
with `-Kind Database`, `-Kind Vimeo`, `-Kind YouTube` or `-Kind Storage`. `-Kind
Providers` prompts for Vimeo and YouTube only. Existing encrypted files are
preserved: the helper stops rather than replacing them. A partially completed
`All` leaves already-created files intact; use the remaining granular kinds
instead of deleting them blindly. A future attempt may need a fresh bounded
handoff because consumed files are deleted, not because the saved password needs
resetting.

## Approval and bounded dev execution

The concrete batch limit and source seals live in
[`dev-batch-packet.json`](dev-batch-packet.json). They bind the exact source CSVs,
taxonomy/override content and baseline SVG to the verified dev target. The current
packet covers 285 competitors, 1,754 accounts, 202 Vimeo rows, 128 YouTube rows,
460 website rows, 267 remote logo sources and at most 20 MiB of uploaded logos,
with expected incremental provider spend USD 0 and paid-provider calls 0. Retry,
redirect and request limits remain bounded in the adapters. This packet is not a
content backfill or collection approval.

Codex records the owner's specific bounded dev-batch approval before consuming
credentials or running the bulk stages. Merely creating handoff files, stating an
intention or approving M01 does not set that approval. A source/baseline/packet
change invalidates the built source seal and requires review plus a fresh
credential-free build; never turn `approved` on to bypass the owner decision.

Codex can check the reviewed runner seal and required file presence without
decrypting or authenticating:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\Invoke-M02Dev.ps1' -Action accept-dev -CheckOnly
```

Expected non-secret result: `M02 runner/source seal and required handoff files
verified; authentication not tested.` Missing provider files are reported
individually; `CheckOnly` never establishes MA-07/08 completion. If approval is
still pending, that fact is printed too. A missing required file or changed seal
stops before decryption/authentication.

After the exact packet is approved and the handoffs are ready, Codex runs:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\Invoke-M02Dev.ps1' -Action accept-dev
```

The consumer verifies the source inventory/seals, then runs a credential-free
Postgres SSLRequest/TLS preflight with the scoped public CA before reading any
private handoff. The preflight sends no StartupMessage or login. It must verify
the fixed dev hostname and close its sockets with native exit0. Any failed or
ambiguous preflight preserves every private handoff and stops before decryption.
`CheckOnly` remains a presence/seal check and does not run TLS or authenticate.

After that preflight, the consumer decrypts only the credentials needed by the
selected action. It starts one hidden plain-Node child
with a minimal environment, fixed password-free dev URI and the private values
only in that child's environment. Raw stdout/stderr are discarded; no provider
body, credential-bearing connection URL or raw error is printed. The CLI verifies
the actual postgres login/database and the exact seven M01 migration versions.
The CLI has a 40-minute cancellation deadline; the consumer has a 45-minute outer
bound and confirms child exit.

`accept-dev` runs seed plus a real no-change second seed, public provider
resolution, website/format checks, bounded logo copy/readback and the report. A
missing/blocked provider is reported independently; another available provider
and independent stages can still progress. Existing successful resolutions and
owned logos are preserved. The narrower consumer actions are:

| Action     | Purpose                                                    | Credentials consumed                    |
| ---------- | ---------------------------------------------------------- | --------------------------------------- |
| `seed`     | Seed and verify no-change second run                       | Dev database                            |
| `probe`    | Public known-account authorization probes; no DB writes    | Dev database; present provider handoffs |
| `resolve`  | One reviewed post-batch YouTube-only continuation          | Dev database; required YouTube handoff  |
| `websites` | Website reachability and format-only IG/LinkedIn checks    | Dev database                            |
| `logos`    | Create-only logo upload, metadata and public byte readback | Dev database; dev Storage key           |
| `report`   | Read-only hosted snapshot report                           | Dev database                            |

All non-report hosted actions remain packet-gated. The runtime rejects prod even
if `--target prod` is supplied. No production key or password belongs in any M02
dev handoff.

### Completed YouTube continuation — historical procedure

Completed18October2026 at code head `d5171fe`; native0 and independent22/22
preservation checks pass. The instructions below describe that completed
continuation. They are not a request for another handoff or invocation. The
current next action is MA-09, with no credential delivery needed.

The original consumption/recovery record is permanent. An existing seed
manifest independently prevents an alternate action from replaying the initial
batch, even if that record is missing. `resolve` requires the exact reviewed
source/target/run-bound recovery and evidence hashes. The exclusive
`dev-youtube-continuation-admission.json` is also permanent after success or
failure: another invocation cannot silently reuse the same budget. Do not remove
either record to retry.

The continuation verifies all202 Vimeo rows are already resolved and the managed
YouTube population is128. It allows one attempt per lookup, including the known
account probe: at most129 additional requests, USD0. The conservative combined
YouTube ceiling is413 units versus the original516-unit allowance; all-provider
ceiling1,225 requests versus1,328. These are bounds, not measured request counts.
It does not run the seed, website or logo stages. Three original legacy invalid
YouTube URLs stay for MA-09; no fixture or guessed handle is added.

Only after the correction is reviewed, built and source-sealed, replenish the
two consumed inputs from the separately saved originals in Windows PowerShell:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind Database
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind YouTube
```

Use the EXISTING emr-dev database password at the first hidden prompt and the
existing YouTube-restricted key at the second. Expected final lines contain
`M02 encrypted dev handoffs saved: Database.` and
`M02 encrypted dev handoffs saved: YouTube.` Close that PowerShell window and
reply `M02 Database and YouTube ready`. Do not send secret values or file contents.
No reset, Vimeo/Storage handoff, production credential or new batch approval is
needed. File presence still does not prove authentication.

Codex then runs only the existing consumer `-Action resolve -CheckOnly`, followed
by one `-Action resolve` invocation after all gates pass. On any failure, reconcile
actual state before deciding what remains; the retained admission record prevents
a blind repeat. The diagnostic consumer pinned to the original child7492 has
expired and must not be relaxed or reused; its attempted admission made no API
call and read no credential.

Expected completion prints the native exit code and the sanitized receipt path
`scripts/seed/out/dev-latest.json`, followed by child/temporary-file cleanup state.
Exit 0 may still have `nativeCompletion: completed_with_blockers`; inspect the
stage results before claiming acceptance. File presence, a successful build,
saved provider settings, local mocks and real API authentication are different
evidence.

The consumer removes consumed encrypted files after the bounded attempt and
closes its credential-bearing child. Unconsumed files for other actions remain
available. Verify cleanup if it reports any failure. The owner's separately saved
originals remain unchanged. Clearing a child shell does not clear a separately
configured parent VS Code environment; this DPAPI workflow does not require
putting secrets into the parent.

## Reports, ownership and recovery

`scripts/seed/out/` is Git-ignored. It contains the local plan, sealed runner,
sanitized `dev-latest.json`/dated receipts, `dev-report.json`, dated Markdown
reports and `unresolved.csv`. Reports label their actual environment and target.
They list tier/platform/status/backfill counts, valid ID coverage, invalid or
unreachable accounts, duplicates and missing logos. Public Storage readback is
separate from a stored `logo_path`; public-account resolution is separate from a
provider token's presence. [`../assert/m02_counts.sql`](../assert/m02_counts.sql)
is read-only and deliberately reports AC7 and public-logo visibility limitations.

The initial local plan has three invalid legacy YouTube URLs: **C102** and
**C245** (next wave), and **C283** (pilot). Earlier prose incorrectly called C102
the pilot exception; the CSV and actual hosted tiers agree on C283. These are
source-format findings, not API password failures.
The eventual concrete live report, including these and any other unresolved
accounts, goes to MA-09 for owner decisions. Do not infer sign-off now. Put
approved URL fixes/invalid/add decisions in `overrides.csv`, then review/reseal
the changed source packet before the corresponding rerun.

`dev-seed-manifest.json` and `dev-logo-manifest.json` retain target-bound ownership
receipts. A seed updates only fields still owned by its prior receipt; operational
state and human changes survive. **Seed never overwrites admin-edited fields**,
including once the M11 admin UI exists. With no ownership manifest, all fields
of every existing row are protected, including fields that happen to equal the
CSV today. Matching values do not create ownership. Do not reconstruct or adopt
a lost manifest from current rows.

`dev-write-pending.json` and `dev-seed-pending.json` are durable admission/recovery
markers. Any exception, timeout, failed receipt/manifest write or ambiguous
response can occur after a successful DB or Storage operation. Preserve these
files and actual effects. **Do not delete pending markers or blindly replay.**
First reconcile the actual dev database rows, migration/schema baseline, Storage
objects and public bytes against the source seals, manifests and sanitized
receipts. Record the observed outcome and a reviewed recovery decision; only
then manually release the specific reconciled gate or resume the verified
remaining stage. A new credential handoff does not resolve an ambiguous write.

M02 stays open until hosted criteria and MA-09 pass. Prod needs its own reviewed
M02 packet and separate owner approval after dev acceptance; merge and the next
milestone remain separate decisions.

## Primary references

- [Vimeo authentication](https://developer.vimeo.com/api/authentication) and the
  [M02 provider source review](../../milestones/M02-seed-data/evidence/provider-source-review-20261018.md).
- [YouTube API setup](https://developers.google.com/youtube/data/getting-started)
  and [Google API key restrictions](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys).
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys) and the
  project's binding [M02 milestone](../../milestones/M02-seed-data/MILESTONE.md).
- [Supabase certificate-chain and hostname verification](https://supabase.com/docs/guides/platform/ssl-enforcement).
