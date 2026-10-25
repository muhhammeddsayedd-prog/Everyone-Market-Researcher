# M03 actor admission (source and local tests)

`20261018231756_m03_actor_launch_admission.sql` adds four worker RPCs and two
internal RLS tables. It creates no approval row, fixture or provider request.
The separate foundation gateway migration/window is required for hosted use.
The ten existing migrations and closed GW-01 window are preserved.

Four CLI-created forward versions are pending on hosted dev:
`20261018231756`, `20261018232014`, `20261018232922` and `20261018233338`.
All four are applied only on the existing local PostgreSQL17 stack. The latter
two retain the already-applied local source versions while recording reviewed
clock/cost/JSON/receipt hardening. No local migration history was fabricated or
reset. The separate foundation window is
`df4f29ec-e2dc-4d82-a276-62a4e695e6f9`, with 256 admitted attempts, 60 minutes
from first admission, two concurrent leases, 30 per minute and 500 per Cairo day.
No window or approval row is inserted by the migrations. Owner-only provisioning
binds the exact Preview/deployment/source and the reviewed immutable build
`0.3.99` (`BdKJRCYsnmlzPfH3n`); first admission starts the same actor-approval
clock. Close fences unresolved reservations, closes actor admission and clears
leases. It never reopens either window.

`ops.authorize_apify_launch(p)` consumes at most one of two sequential starts
under an owner-installed, expiring dev approval. Its strict object carries
`window_id`, `launch_id`, `run_id`, `account_id`, `execution_id`, `actor_id`,
`actor_build`, `input`, `memory_mb`, `timeout_seconds`, `max_total_charge_usd`.
It accepts only the owned C999 fixture, the exact Everyone About page and the
source-defined one-page Cheerio body. Build must be an immutable build number;
memory is 1024 MiB, timeout 300 seconds, actor retries zero and concurrency one.
No approval is inherited from GW-01. Approval, fixture and account claim are
checked atomically before the durable POST-intent receipt is inserted.

The first result has `authorized: true`. Every same-launch replay returns
`authorized: false, reason: reconciliation_required`. Gateway receipt replay,
status recovery or a saved prior true response must never become another POST
permission. The provider node must have automatic retries disabled. A crash
between admission and launch deliberately leaves an unresolved receipt; absence
of a returned run ID does not prove that the provider never accepted the POST.

`ops.get_apify_launch(launch_id)` returns only the bounded launch receipt.
`ops.reconcile_apify_launch(p)` accepts exactly `launch_id`, `apify_run_id`,
`actor_id`, `actor_build`, `started_at` and `input`, projected from authenticated
readback of the **original returned run ID** and its INPUT record. Callback
payloads and guessed matching candidates are not that proof. Missing original
ID stays blocked for owner reconciliation. SQL checks the exact actor/build/
input and launch-time range, registers the original once and rejects replacement
IDs. This is a trusted-worker RPC; SQL itself does not authenticate Apify HTTP.
The second start remains blocked until the first original is registered and
atomically processed, with actual usage retained separately for both runs.

The foundation HTTPS alias for reconciliation accepts only `launchId` and
`apifyRunId`. Its fixed server reader obtains authenticated bounded run/INPUT
metadata before calling the underlying six-field RPC. Terminal/dataset readers
first mark a one-shot durable `read_started` reservation, then store the bounded
result with atomic completion. Failed or ambiguous external reads stay unresolved;
status readback does not authorize another network request. The processor also
requires two equal durable terminal samples 10–180 seconds apart and, for a
successful run, a later matching dataset receipt whose exact payload equals the
normalized group. The pgTAP delay uses explicit rollback-only timestamp fixtures;
it is not observed provider settlement. Cost replay accepts only the complete
four-field registered attribution and an equal already-processed cost receipt.

`ops.reject_apify_callback(p)` accepts only `execution_id`, `apify_run_id` and
a fixed `reason`: `unregistered`, `actor_mismatch`, `registry_mismatch`,
`unsettled`, `unsupported_input`, `registration_race` or `metadata_unavailable`.
It inserts exactly `apify_callback_rejected`, deduplicated per execution, and
never changes items, runs, accounts, costs, queues or notification cooldowns.
Generic workflow errors do not stand in for this receipt.

Current official sources checked 19 October 2026:

- [Run Actor API](https://docs.apify.com/api/v2/actors-runs-post): build-number
  selection, asynchronous `waitForFinish=0`, `restartOnError=false`, and documented
  `maxTotalChargeUsd` across pricing models. The selected actor is pay-per-usage.
  Transmitting the documented cap is not observed enforcement or invoice proof;
  application reservation/stop rules and later actual provider options/usage
  readback remain separate.
- [Crawler input schema](https://apify.com/apify/website-content-crawler/input-schema):
  depth/page/result/concurrency/retry controls and disabled files, summarization,
  sitemap and llms.txt processing. No general crawler is introduced.
- [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html):
  the parent/approval row locks serialize competing quota and registration work.
- [Supabase functions](https://supabase.com/docs/guides/database/functions):
  definer functions stay in non-exposed `ops`, with empty search paths and explicit
  EXECUTE grants only to `n8n_writer`; tables have no worker grants.

`supabase/tests/12_m03_launch_admission.test.sql` uses rollback-only synthetic
local fixtures. Its two callback/cost rows are SQL fixtures, never actor results
or hosted acceptance. Local/CI tests cannot authorize or prove the final live
foundation batch. That batch still requires the separate exact approval packet.

The concurrency checker has two explicit modes:

```sh
node --test scripts/db/check-m03-foundation-concurrency.test.mjs
node scripts/db/check-m03-foundation-concurrency.mjs --local --gateway-only
```

Ordinary local mode preserves the existing C999/Test House. It tests real
simultaneous SQL sessions, a third-reservation denial, an observed overlapping
duplicate with one audit side effect, deliberately discarded acknowledgement
recovered through status, and persistent closure. It deletes only its owned
temporary window/audit records and compares the retained data/history snapshot.
It does not run the actor-admission race or prove a restricted network login.
`--ci` additionally requires both GitHub CI flags and an absent C999 namespace.
The CI-only runner uses its fresh `--no-seed` reset for the two-session actor
admission race, cleans the owned synthetic fixture, then performs the existing
normal reset/seed and retained suites. Never simulate those flags on an ordinary
developer stack to get past the fixture boundary.
