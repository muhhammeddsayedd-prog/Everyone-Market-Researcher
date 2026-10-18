# M02 dev import and public account checks — approval packet

State: **approved by the owner on18October2026**, reply **Approve M02 dev batch**
(question call_0e6df79cdf024f3b99d026f52e3a6ff5). This packet covers emr-dev only,
`zmotjsbzhzjvpelxvxlf`. The runtime rejects production. M01's production approval
and PR4 merge do not approve M02 production seeding.

The owner already authorized M02 development and dev seeding. This additional
gate is the concrete bulk estimate required by [AGENTS.md rule 9](../../../AGENTS.md):
“Before any backfill or bulk run, post the estimated items and USD cost
(from `ops.price_book`) and wait for approval.” No content backfill is included.

## Exact payload and bounds

| Operation | Reviewed amount and boundary |
| --- | --- |
| Competitors | 285; baseline1 / pilot50 / next_wave174 / adjacent60 |
| Accounts | 1,272 primary +256 stories +226 employees =1,754 |
| Dev seed | One transactional import, then a second seed proving zero inserts/updates; no fixture or test-house import |
| Vimeo | Up to202 public account lookups; concurrency2; bounded retries/cooldowns; known C000 public probe first |
| YouTube | Up to128 account lookups; `channels.list` only; about130 free quota units expected, at most516 units including conservative probe/retry allowance; no `search.list` |
| Websites | 460 root/work-page reachability checks; concurrency5; 10s per request; GET only after405/501; bounded same-domain redirects |
| Instagram / LinkedIn | Format validation only; zero anonymous social requests |
| Logos | 267 source URLs plus the checked-in C000 SVG; 5MiB per download, one403 Referer retry; create-only public media objects; **20MiB cumulative upload ceiling** |
| Paid providers | Zero Apify, Firecrawl, SerpAPI or OpenAI calls |
| Production / workflows | Zero production writes, migrations, collection, n8n executions or schedule changes |

Direct provider requests have at most four attempts each. The conservative API
ceiling is `(202 +128 +2 probes) ×4 =1,328` requests. The ordinary plan currently
has three invalid legacy YouTube URLs, so those do not make live lookup requests.
They remain visible for MA-09: C102 `/mvmpro` (pilot), C245
`/firstandtenproductions`, C283 `/wonderfulprodbeirut`.

Estimated **incremental provider cost: USD0**, using the free official APIs and
public HTTP. The actual dev `ops.price_book` readback contains17 priced rows;
none prices these direct Vimeo/YouTube/HTTP operations. Its paid provider SKUs
are unused. Supabase remains on its existing plan: this packet does not purchase
capacity or increase a spending limit. A quota/budget block stops that provider;
there is no paid fallback. Storage is limited to20MiB for this batch rather than
assuming every source image is small.

## Immutable inputs

Machine packet: [dev-batch-packet.json](../../../scripts/seed/dev-batch-packet.json).
The runtime checks exact source payload, baseline SVG and item counts before
database authentication or API requests. The Windows consumer verifies the
prebuilt plain-Node runner and complete source/data/packet hashes before
decrypting any handoff.

- CSV/taxonomy/override payload SHA256:
  `135e6b24c632bb931b54025a09941963b777ada87ba25c58306a430756d32f66`.
- Baseline SVG SHA256:
  `956befb784a4499230bcb2162660665d95e8e00aa7aa0ba95e2a1bc4cf8d1f4d`.
- Source overrides currently contain only the documented header. No automatic
  URL guesses, competitor merges or invented resolution IDs are approved.

## Verification and recovery

The consumer injects only the fixed dev database URI/private password and the
available relevant keys into its bounded plain-Node child. It does not run an
installer/compiler with credentials. Missing provider/Storage keys become
separate blocked stages while available seed/website checks continue. Consumed
DPAPI handoffs are removed and credential-bearing children are closed; the
owner's separately saved originals remain for later integrations.

Dev acceptance records actual authentication, original seven migration versions,
seed counts, exact second-run no-op, provider IDs/denominators, website errors,
public logo byte hashes and metadata, read-only count assertions and advisors.
Local tests, CI, hosted dev and later production evidence stay separate. MA-09
and all hosted criteria remain open until their receipts exist.

Every write batch takes an exclusive durable pending marker. An error or
ambiguous write leaves it in place. Reconcile actual DB rows, original migration
history, media metadata/public bytes and manifests before a reviewed retry;
never delete collected rows, reset a database, fabricate history or overwrite a
human edit. A lost manifest protects all existing fields, including initially
equal ones. Storage uploads use `upsert:false`; metadata commits use ownership
and logo-path compare-and-set checks. Receipt persistence and connection shutdown
must complete before the run releases its marker.

Expected approval reply: **Approve M02 dev batch**. This authorizes this bounded
dev packet only. MA-09, `approved: seed prod`, and eventual M02 PR merge remain
separate decisions. M03 remains unstarted.
