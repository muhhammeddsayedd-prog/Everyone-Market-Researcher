# M02 production seed — exact approval packet

State: **production approval pending**. Prepared18October2026 Cairo for
emr-prod / `hkiafqrcxaafdbcvjlzv`. The production runtime, immutable public
payload and two-input private consumer are implemented. No production connection,
credential read, logo download/upload or provider request was made during this
preparation. The machine packet remains `approved:false`, approval reference null.
M01's production approval does not authorize M02 seeding.

The next owner decision is **`approved: seed prod`**, covering only this packet.
Final source/runner seals, [independent review](prod-preparation-review-20261018.json),
focused checks and normal PR CI must be recorded before presenting it. PR6 merge,
M03, collection, paid calls, n8n execution and schedule activation remain separate.

## Exact payload, request bounds and cost

Promote the accepted dev seed configuration and verified public account IDs.
Download only the exact257 already verified public dev Storage objects, verify
their frozen hashes, then copy unchanged bytes to production. Do not repeat
Vimeo/YouTube lookups, website checks or competitor-logo-source downloads.

This is the proposed T10 deviation recorded in `docs/DECISIONS.md`: promote
reviewed T2–T8 results instead of repeating external discovery. Approval of this
packet covers that approach. Dev receipts prove the earlier provider verification;
production receipts prove imported configuration/bytes, not a new provider exchange.

| Operation              | Exact bound                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Competitors            | 285: pilot50 / next_wave174 / adjacent60 / baseline1; C000 only                                   |
| Primary accounts       | 1,272: website261 / work-page199 / Instagram256 / Vimeo202 / YouTube128 / LinkedIn226             |
| Derived accounts       | 256 stories +226 employees; total1,754                                                            |
| Import                 | One transactional seed/frozen import; real immediate second seed/import with zero inserts/updates |
| Vimeo                  | 202 resolved IDs; pilot/baseline48/48                                                             |
| YouTube                | 121 resolved + seven retained invalid; zero pending; raw pilot10/11                               |
| Exact exclusions       | C102, C142, C218, C231, C233, C245, C283; YouTube only; retain rows and never collect them        |
| Eligible YouTube       | 121/121 overall,10/10 pilot after those exclusions; retain raw121/128 and10/11                    |
| Website findings       | Keep23 accepted flags and existing gating; no new reachability claim                              |
| Logos                  | 257 objects:256 source copies + C000 SVG; exactly1,560,325 uploaded bytes                         |
| Fallbacks              | 11 accepted missing source copies +17 no-source logos;28 null logo paths                          |
| Public dev Storage     | At most257 GETs; fixed project, exact sealed paths/hash/MIME/dimensions/sizes                     |
| Production Storage     | At most257 create-only POSTs +257 public GET/hash checks, once per exact path                     |
| Paid/profile providers | Zero Vimeo, YouTube, Apify, Firecrawl, SerpAPI or OpenAI calls; zero quota units                  |
| Content/fixtures       | Zero collection/backfill; no `seed.sql`, C999/test-house, test accounts or later data             |
| Schema/controls        | Zero migrations, grants, role/default/auth changes, bucket recreation or schedules                |

Incremental provider estimate: **USD0**. The existing dev price-book receipt has
17 priced rows and no SKU for these direct public Storage reads; no paid SKU is
used. This is not a fresh production price-book read or a promise about the
existing Supabase subscription bill. No capacity purchase/spending-limit increase.

Hard Storage HTTP bound: **771 requests**, no automatic retry or redirect.
Expected verified bytes:1,560,325 dev download +1,560,325 upload +1,560,325 prod
readback =4,680,975 content bytes, excluding protocol headers. Each read has its
exact manifest-size body bound. Every upload must match sealed bytes/MIME and
may be attempted only once; cumulative upload is also below20MiB. Database
statements and the password-free TLS handshake are separate from Storage counts.

The owner accepted all23 flags/11 fallbacks and instructed skipping unavailable
social accounts. The seven exclusions apply to these listed sources; they do
not prove company-wide absence of YouTube. No guessed IDs or replacement URLs.

## Immutable public inputs

The [freeze receipt](prod-payload-freeze-20261018.json) binds accepted dev readback
to these public files. The same observed instant is ISO
`2026-10-18T01:54:53Z`; its original raw form is preserved in that receipt.

| Input                                  | SHA256                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| CSV/taxonomy/seven MA-09 overrides     | `b3cf64b90058b5c786513c4fed9ebbe9d9bb092ec3a916744c944faeb826a17b` |
| `scripts/seed/prod-payload.json`       | `5d5e8089bebe184cccaccdb7ceefe5d6e3ba40b83dedfa494913c468af36102d` |
| `scripts/seed/prod-logo-manifest.json` | `b1885fdd3dab4ec4f06ceaeaad59ae0f85bf8b73400b82a29f178f89a302bb80` |
| C000 original SVG                      | `956befb784a4499230bcb2162660665d95e8e00aa7aa0ba95e2a1bc4cf8d1f4d` |
| Official public Supabase root CA       | `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7` |

These are public file/certificate hashes, never password hashes. The earlier
dev source hash `135e6b24...2f66` remains historical; the seven explicit invalid
overrides changed the source hash above. No dev UUID/media ID, operational
timestamp, lease, collection cursor/counter, auth row or credential is promoted.

Validation binds each account to its current source key/company/platform/original
normalized identity and accepted final fields. Only reviewed same-domain website
redirects are permitted. Explicit YouTube channel URLs must match the frozen ID;
Vimeo IDs must be canonical positive numerals. Private URL/query keys, unknown
fields, unsupported platforms, missing/duplicate identities and volume drift stop
before authentication. Logos bind exact owner/slug/path/source/MIME/dimensions/
size/hash. Their download URL derives only from fixed dev public Storage.
Production generates its own IDs; WebP bytes are never re-encoded.

## Exact executable path after approval

The dev runtime and spent admission records stay unchanged. The separate path is
`prod-seed-packet.json`, `prod-build-runner.mjs`, `prod-cli.ts` and the new Windows
helpers below. A credential-free build creates `out/prod-runner.mjs` and its
complete source seal. Runtime has a25-minute cancellation deadline; the consumer
has a30-minute outer bound.

After the owner approves this exact packet, record the approval/reference in the
existing progress/evidence and machine packet, then rebuild without credentials.
Both consumer/runtime validate approval/reference and all source/data hashes.
Approved with a null/blank reference fails before decryption.

Only then supply two existing production credentials. Locate the existing
emr-prod database password in the owner's password manager, without resetting it.
In **Supabase → emr-prod (`hkiafqrcxaafdbcvjlzv`) → Settings → API Keys**, locate
the production **Secret key**, not a publishable/dev key. Open Windows PowerShell
under the same Windows account:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02ProdHandoff.ps1' -Kind All
```

Enter the existing prod database password, then emr-prod Secret key at its two
hidden prompts. Expected final line: `M02 encrypted prod handoffs saved: All.`
Close that PowerShell window; reply **M02 prod handoffs ready**. Send no secrets,
connection URLs or file contents. The new files are
`%LOCALAPPDATA%\Temp\emr-m02-prod-db-password.dpapi` and
`%LOCALAPPDATA%\Temp\emr-m02-prod-storage-key.dpapi`. No dev/M01/machine-role or
Vimeo/YouTube handoff is requested/reused. Keep owner-saved originals.

Codex checks presence/seals, then invokes the bounded consumer once:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\Invoke-M02Prod.ps1' -CheckOnly
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\Invoke-M02Prod.ps1'
```

`CheckOnly` proves seals/presence, not decryption, TLS or authentication. The real
invocation validates public inputs and strict password-free TLS before opening
private files. Failed preflight preserves both handoffs. No installer/compiler/
test receives real credentials. The consumer holds each consumed file handle
through child closure, deleting that exact temporary handoff on close. Raw
stdout/stderr/credential-bearing errors remain withheld.

## Actual production gates and verification

1. Authenticate directly and verify current/session user `postgres`, database
   `postgres`, fixed session pooler `aws-1-eu-central-1.pooler.supabase.com:5432`,
   user `postgres.hkiafqrcxaafdbcvjlzv`. Password never enters URI/arguments.
   Verify original versions `20261017172928`, `20261017172931`, `20261017172934`,
   `20261017172937`, `20261017172940`, `20261017172943`, `20261017172945`.
2. Require empty M02 catalog/assets/collected/account state and all `media`
   objects, plus the existing public bucket. Nonempty/unmanaged state stops.
   Acquire target/payload-bound pending and permanent one-use admission records
   before the first public object request; any durable prior state blocks replay.
3. Fetch/verify257 frozen dev objects, lock/recheck the empty catalog and import
   285/1,754 plus accepted configuration in one transaction. Persist new ownership.
   Lock/strictly verify accepted accounts before a real second seed/import; human
   divergence stops before updating. Require all second-run mutation counters0.
4. Upload with `upsert:false`, verify production public bytes, lock the new
   competitor and require absent metadata, then commit same-owner metadata/null-
   path CAS. Duplicate/wrong-owner/human-path changes stop. Never SQL-write
   `storage.objects`, overwrite or delete an object.
5. Execute sealed `scripts/assert/m02_counts.sql` read-only and save production
   results; AC7 still uses its separate real no-op receipt. Verify all seed-owned
   competitor fields, account IDs/resolution, default cadence/backfill/operational
   state,257 assets/objects, source/owner/dimensions/MIME/size/path mappings,
   28 null fallbacks, no duplicates, zero collected rows/fixtures. Exact final
   configuration verification uses repeatable read; raw/eligible counts stay separate.
6. Save `prod-latest.json`, immutable run-ID receipts, manifests, report/count
   assertions/public snapshot and257 actual byte hashes. Run populated-production
   advisors separately against the accepted baseline. Preserve RLS/grants/views/
   RPC restrictions, queues and housekeeping; no schema/type change is included.
   Schema mismatch stops for review, never ad hoc migration/history repair.
7. Verify native completion, child closure and consumed-file absence. Release
   pending only after DB shutdown/receipt persistence; retain permanent admission.
   Preserve Email disabled, Google configuration, empty domain auto-join and
   signup/invite/membership restrictions. No OAuth/browser journey is performed.

## Failure and recovery

There is no destructive rollback. An uncommitted DB transaction rolls back;
committed rows/uploads, ownership, failure receipt and both admission/pending gates
remain. Timeout/native failure is not proof of no write. Early rejected attempts
leave the old receipt byte-identical; admitted failures get immutable run-ID archives.

Reconcile actual rows, original migration/schema baseline, objects and public
hashes against the sealed payload/manifests. An uploaded object without metadata
is an orphan to verify/recover through a reviewed same-owner transaction, not
delete/overwrite. Lost ownership never permits adoption. Record a stage-specific
recovery decision before a bounded remaining-stage consumer; never remove the
permanent admission, blindly replay, reset production, fabricate history or
delete collected rows.

## Readiness evidence and remaining gates

Focused local results:38 distinct core checks, including7 actual plain-Node CLI checks
in isolated public fixtures with network denied;3 offline CA checks;32 synthetic
Windows-consumer checks;6 actual local PostgreSQL rollback-only component checks.
The latter use five fixture competitors/11 accounts and preserve C999/all prior
rows; they do not claim a full285-row production rehearsal. CLI fault injection
uses explicit local fake DB/network modules, not actual production authentication.
Normal PR CI, final source seal and independent review are separate receipts at
the final reviewable head.

Clean-checkout CI39090441239 exposed a missing test output parent and an older
LF Git representation of the reviewed CRLF CSVs. The corrected CLI suite passes7/7,
including an initially failing cold-parent regression. The [byte-delivery proof](prod-source-byte-delivery-20261018.json)
shows all four indexed source inputs exactly match the reviewed working bytes;
only line endings changed relative to the earlier two CSV blobs. The reviewed
source/payload/logo hashes above and all rows/values remain unchanged. That
failed CI is preserved; a new clean-checkout CI pass is required before approval.

No logo bytes were bulk-downloaded during preparation. Actual production
preflight/import/transfers, populated advisors and AC10 remain unperformed pending
**`approved: seed prod`** and two production-only handoffs. This packet does not
merge PR6 or start M03.
