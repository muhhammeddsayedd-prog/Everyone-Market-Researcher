# GW-01 — proposed strict-TLS dev connection change

18 October 2026, Africa/Cairo. **PROPOSAL ONLY — owner decision required.**
No gateway code, dependency installation, credential copy, migration, hosted
configuration, workflow rewiring or new connection test was performed for this
proposal. The nine applied dev migrations and existing binding decisions remain
unchanged. PR8 stays draft; M03 stays open.

## Recommendation and the decision

Retain n8n Cloud and Supabase. Add a small authenticated worker-RPC gateway to
the existing Next.js/Vercel application, initially on one protected, dev-only
branch preview. It connects directly as the actual dev `n8n_writer` using the
pinned public Supabase CA and normal hostname validation. n8n uses fixed HTTPS
operations, rather than its native Postgres transport, for this approved path.
This is an additional security boundary, not a claim that HTTPS repairs the
native node or that the gateway is already accepted.

The repository's `apps/web` is currently a static Next.js16.4.2 placeholder with
no API routes or database dependency. Its existing Vercel Git project is
`everyone-market-researcher`, root `apps/web`; Node24 is the project baseline.
The deployment/protection/region settings and available entitlements must be
read back before any future deployment. No account fee or protection state is
inferred from the current green preview.

The observed n8n2.43.5 Postgres credential has no CA property. Its native
transport supports SSL on/off and an insecure verification bypass, rather than
a custom trust object. n8n's documented custom-CA mechanism mounts certificates
inside infrastructure controlled by the runtime operator. Windows trust does
not change n8n Cloud. Keep the saved credential unchanged and do not retest it
without a relevant change. Support/forum contact was declined and is excluded.
See [credential source](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/credentials/Postgres.credentials.ts),
[transport source](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Postgres/transport/index.ts)
and [custom CA documentation](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-custom-ssl-certificate-authorities).

| Choice | Benefit | Additional cost/risk | Recommendation |
| --- | --- | --- | --- |
| Existing Vercel Node gateway | Keeps the shared Cloud instance and provider credentials; explicit database trust is under project control | New authenticated route, distributed admission/idempotency records and adapter tests; two network hops | Recommended bounded dev trial |
| Separate controlled/self-hosted n8n for Market Radar, with the public CA mounted | Can retain native Postgres nodes and validate the original native path | New runtime, patching, backups/encryption-key custody, availability and credential delivery; hosting/licensing costs unverified | Viable alternative, broader operational change; no shared-instance migration proposed |

## Exact proposed change surface

These are planned files, **not implementations created by this packet**:

- `apps/web/app/api/internal/n8n/rpc/route.ts`: POST-only `runtime='nodejs'` route, dynamic,
  no caching, `maxDuration=30`, preferred region `fra1` after entitlement readback.
- `apps/web/server/n8n-worker/{auth,contracts,dispatcher,database,admission,errors}.ts`
  and colocated tests: server-only modules, typed closed operation map, private
  connection configuration and fixed output/error projection.
- `apps/web/server/n8n-worker/certs/supabase-root-2021.crt`: copy of the existing
  public certificate, SHA256
  `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
- `apps/web/package.json` and the root lockfile: explicitly pinned `pg`, types
  and `@vercel/functions`, selected/reviewed before installation. No dependency
  is added now; no copied node-postgres SSL URL parameters are allowed.
- One **new, separately generated additive dev migration**, using
  `supabase migration new n8n_worker_gateway_admission`, plus its pgTAP file and
  regenerated four-schema types. It provides private request/rate records and
  narrow admission/execution/status RPCs. It never edits/replays the nine
  existing versions. Local/advisor/type and exact-version dev deployment gates
  apply before this new migration can be used.
- `n8n/foundation/build-worker-rpc.mjs` and tests, then adapters in
  `build-foundation.mjs`, `build-health.mjs`, `build-apify-preflight.mjs` and the
  callback/smoke generators. Replace only owned M03 database nodes after approval;
  retain generated native transport as a separate, currently unaccepted option.
- `packages/shared/src/n8n-worker-contracts.ts` and binding-validator tests;
  a new logical gateway credential reference and fixed deployment audience.
  Preserve all five existing provider/database credentials.
- Future actual sanitized M03 workflow exports, `n8n/README.md`, environment and
  acceptance documentation. Binding decisions/AC2 are amended **only after**
  approval to distinguish gateway restricted-login evidence from native failure.

The extra database admission migration is an explicit part of this proposal,
not an unnoticed consequence of a connection-string change. The missing exact
`apify_callback_rejected` audit path remains its own M03 design/test gate; this
packet does not silently approve an unrelated schema change or fake that action.

## Closed request and operation contracts

One fixed route accepts a strict discriminated union:
`{version:1, requestId:UUID, operation:<allowlisted alias>, args:<typed object>}`.
Reject unknown keys, unsupported versions and arbitrary operation names. Callers
cannot select SQL, schema/RPC identifiers, hosts, database, role, project, CA,
environment, credential, URL or transaction settings. Responses are a validated
`{version:1,requestId,outcome,result}` or fixed `{error:{code},requestId}` shape.
Request IDs identify durable work; a retry reuses the same ID and exact args.

| Proposed operation alias | Fixed SQL target and bounded input | Typed result |
| --- | --- | --- |
| `identity.read` | Fixed SELECT of `current_user`, `session_user`, `current_database()` | Exact writer identities, database and configured dev target assertion; no privileged SET ROLE |
| `request.status` | New private `ops.worker_gateway_status`; `args.targetRequestId:UUID`, no caller SQL | Absent/in-flight/completed/definitely rejected state and bounded saved receipt; lookup cannot create/re-execute work |
| `run.start` | `ops.start_run`; known owned workflow, nullable supported platform, dev/mode enum, bounded execution ID | Run UUID, saved for this request |
| `run.finish` | `ops.finish_run`; UUID/status/fixed error code; durable completion context checked | Bounded run summary; never permission to redispatch on replay |
| `apify.register` | `ops.register_apify_run`; actor/run IDs, one owned smoke account, daily purpose | Registered receipt, conflict rejection; never launches an actor |
| `apify.read` | `ops.get_apify_run`; one validated actor-run ID | Whitelisted registry context and saved processing receipt or null |
| `apify.pending` | `ops.apify_runs_pending`; parent UUID | Nonnegative integer |
| `apify.process` | `ops.process_apify_run`; trusted terminal snapshot, exact numeric cost, one group/one exact Everyone page item | Existing durable atomic processing result; schema/row locks and completion-last preserved |
| `cost.log` | `ops.log_cost`; at most20 validated entries for owned run context | Nonnegative inserted count; no unkeyed ambiguous retry |
| `settings.read` | `ops.get_setting`; closed set `daily_budget_usd`, `stories_twice_daily`, `stats_daily_enabled` | Per-key numeric/boolean schema |
| `prices.read` | `ops.get_price_book`; no caller SQL/filters | Bounded reviewed price map; unknown prices remain unknown |
| `error.log` | `ops.log_workflow_error`; existing safe classifier output, fixed kind/owned workflow/IDs, empty raw stack | Void acknowledgement saved by request ID |
| `error.count` | `ops.error_count_24h`; owned workflow and explicit notification-claim flag | Nonnegative count/claim semantics, deduplicated request |
| `health.read` | `ops.daily_health` plus fixed Cairo-date expression | Existing bounded health schema; oversized output fails safely |
| `fees.accrue` | `ops.accrue_fixed_costs`; validated Cairo date within the permitted dev window | Nonnegative count; existing per-day/provider idempotency |

There is no generic `query`, direct table-write operation, raw ingest bypass,
`ops.complete_apify_run` shortcut, service-key route or public schema exposure.
Owned fixture/run/account checks are enforced in both the dispatcher and the
relevant existing RPC, not inferred from a caller's `env` string. Unsupported
collectors, URLs and multi-account branches fail closed.

## Authentication, isolation and logs

Use a **new Market Radar dev-only** random machine token, kept in a dedicated
n8n native HTTP Custom Auth credential; never Variables/Code/Set/browser storage.
It is not any existing shared or incident-affected secret. Vercel stores only
its verifier hash in a Sensitive branch-scoped Preview environment value;
constant-time verification is required. No browser session, anon JWT, Supabase
secret/service key or administrator password substitutes for machine auth.
`EMR_WORKER_DB_PASSWORD` contains only the existing dev writer password, delivered
privately by the owner **after** approval; it is never extracted from n8n.
Neither credential is requested by this proposal.

Compile the dev project, host/port/database/principal and allowed deployment
audience into the reviewed environment configuration. Reject Production,
unapproved preview branches/hosts, missing credentials and
`EMR_WORKER_GATEWAY_ENABLED != true` before any database connection. No prod
secret is installed. No redirect or user-controlled forwarding target exists.

Keep Vercel Deployment Protection enabled. For machine requests, use a separate
owner-approved automation-bypass header plus the route's own machine auth;
never a query-string secret or bypass cookie. Vercel's bypass secret grants
project-wide deployment access, so its broader scope must be explicit in the
owner's credential decision. The native HTTP Custom Auth holds both headers;
exports contain references only. If this protection method is unavailable or
cannot be delivered safely, deployment stops; the implementation must not
silently disable protection or create a new platform.
[Vercel's documented mechanism](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
is separate from application authorization.

Log only operation enum, random request ID, fixed outcome/error class, HTTP
status, elapsed milliseconds and count metrics. No headers, auth/bypass values,
passwords/URLs, request bodies, crawler text, SQL parameters, raw errors/stacks
or verifier hashes in logs, traces, audit payloads or exports. Reject unknown
client input with a fixed code; never serialize Zod's received values. Runtime
and n8n execution-storage behavior must be tested with synthetic canaries before
private credentials or real actor output are admitted. No external notification.

## Actual restricted login and TLS

The server uses explicit connection fields only:
`aws-1-eu-central-1.pooler.supabase.com:5432`, database `postgres`, user
`n8n_writer.zmotjsbzhzjvpelxvxlf`, private writer password. Assert both database
identities equal `n8n_writer` on connection before dispatch. Never connect as
postgres and SET ROLE. The Data API schema exposure and existing private RPC
ACLs stay unchanged; any new admission helpers are non-exposed, hardened and
executable only by the writer, with no direct table DML grant.

Use `ssl.ca` with the checked public PEM, `rejectUnauthorized:true`, minimum
TLS1.2, expected pooler `servername` and Node's normal `checkServerIdentity`.
Certificate chain, expiry and hostname failures abort before an operation.
Do not use a connection URI containing `sslmode`/`sslrootcert` that can replace
the SSL object. Validate a correct certificate plus wrong CA, wrong hostname,
expired and self-signed rejection in isolated credential-free TLS tests.
[node-postgres SSL](https://node-postgres.com/features/ssl) and
[Node24 identity validation](https://nodejs.org/docs/latest-v24.x/api/tls.html#tlscheckserveridentityhostname-cert)
support this design; they do not establish deployed connectivity.

Pool per warm process: `max=1`, `min=0`, acquire/connect timeout3s, idle timeout5s,
always release in `finally`; destroy broken clients. Use the documented
[`attachDatabasePool`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)
lifecycle integration when the observed deployment uses Fluid Compute. Per-process
pool size is **not** a global connection cap across Vercel replicas. The dev
batch allows at most two parallel callers; global database admission permits
at most two business operations, and overload returns503. Observe total session
counts during acceptance and stop on unexpected scaling or connection pressure.
Do not change role/database defaults or shared Supabase pool settings to pass.

## Bounds, durable requests and interrupted work

Application limits:1MiB uncompressed request,512KiB response, strict UTF-8/JSON,
no content encoding, one operation/request. Reject oversized streamed bodies,
including absent/lying Content-Length. These are stricter than Vercel's
[documented4.5MB limit](https://vercel.com/docs/functions/limitations).
Handler deadline20s; function maximum30s; n8n HTTP timeout25s. Per transaction,
use `SET LOCAL` statement timeout8s, lock timeout2s and idle-transaction timeout10s;
no role/database default changes. All work is awaited; no critical write is
delegated to `after()`/unreliable post-response work.

Persist cross-replica limits in the same private database:30 authenticated
requests/minute,500/day, and two business-operation leases. For the trial,
server-only `windowId`, `startsAt` and `expiresAt` must identify one30-minute
window and enforce **100 total admitted calls**, including status polls,
duplicates and retries; server configuration cannot reset its persisted count.
The new dev machine token is unusable outside that window. A sealed acceptance
coordinator also counts **all** network attempts, including invalid-auth/input
denial tests which are rejected before SQL, and stops at100 attempts. No new
window/token is silently created to replenish the limit. Do not use a
process-local Map as the limiter. Authentication/body validation precede SQL.
Admission commits its counter/reservation independently so failed business
operations still consume the admission. A disabled feature/expired token fails
before SQL; anonymous request compute/DoS cost is not claimed to have a hard
application billing ceiling. Use platform protection/rate controls where verified,
without assuming a paid entitlement or altering other services' budgets.

The additive private admission design uses `ops.worker_gateway_requests`,
`ops.worker_gateway_rate_windows` and `ops.worker_gateway_leases`, all RLS-enabled
and inaccessible for direct caller DML. Its only new exposed-to-writer helpers
are `ops.worker_gateway_admit`, `ops.worker_gateway_execute` and
`ops.worker_gateway_status`, with empty search paths and PUBLIC/anon/authenticated
EXECUTE revoked. They remain non-exposed to the Data API. The design stores
request ID, operation, DB-computed
canonical JSONB payload digest, lease/status and bounded result. No full crawler
body or secret is stored. A second request with different args/operation for the
same ID returns409. A business wrapper locks the request and executes a closed
CASE mapping of parameterized RPC calls, saving its outcome **in the same DB
transaction** as the operation. No caller-provided identifier interpolation.
Completion returns the durable receipt; an in-flight duplicate returns202.
The status read uses a fresh envelope `requestId` solely for correlation and
`args.targetRequestId` for the original business request. It is outside business
idempotency admission (but inside the same auth/rate/window counters); it cannot
reserve, execute or change the target. It therefore never sends the original
request ID with a different operation or conflicts with the409 rule. Only the
same client/environment namespace can read that target. It accepts no SQL.
Reservations alone are not proof of success. Failed execution rolls back the
operation; expired reservations require locked reconciliation before reuse.
Keep all M03 request receipts; no TTL deletion or new cleanup schedule is enabled.

An HTTP timeout/disconnect means **outcome unknown**, not failed write. The
adapter queries durable status with the original ID as `targetRequestId` and a
fresh read-envelope ID. A committed
receipt is reused without rerunning costs, start/finish or notifications. While
in flight, back off within a fixed recovery budget; if still ambiguous, stop for
reconciliation. Never generate a replacement request ID to retry uncertain work.
The existing atomic `process_apify_run` receipt remains authoritative for callback
replay and last-step completion. The new transport neither fragments it into
separate HTTP writes nor retries an actor POST. An actor response lost before its
ID was recorded remains a manual provider-reconciliation gate; a gateway ledger
cannot prove that an external actor did not start.

## Proposed dev rollout, cost and rollback

After specific approval only:

1. Implement/review the fixed contracts, route, helpers and inactive adapters
   locally. Generate/test the one additive admission migration; local advisors,
   regenerated types and normal CI must pass. No old migration is replayed.
2. Read back target Vercel project/branch protection/Node/region/lifecycle facts.
   Privately provision only new dev machine auth, approved protection-bypass
   delivery and the owner's existing dev writer password. Do not copy shared
   credentials, read browser storage or use an administrator login in workflows.
3. Deploy only that branch preview with the route disabled, install dev-scoped
   configuration, then enable the dev route for the bounded acceptance window.
   Apply only the new reviewed admission migration to dev under its exact packet.
4. At most100 authenticated gateway requests, at most two concurrent, within
   one30-minute window. No actor/model requests, recurring triggers, real
   competitor collection or production writes. Identity/read checks and
   restricted-client rollback-only RPC/denial checks precede owned inactive
   adapter binding. HTTP idempotency/timeout-after-commit tests use only the
   owned log-only error acknowledgement (UI label `M03 gateway acceptance [dev]`,
   fixed SQL workflow identifier `M03-GATEWAY-ACCEPTANCE-DEV`) and
   gateway admission records, not fake provider costs or collected content.
   Those test audit/admission records are inspected and retained. No C999
   fixture creation is included in this connection-only window. Actual
   item/cost persistence and actor output remain the separately approved
   foundation smoke gate; collected data is never deleted.
5. Stop and disable the route on any certificate/identity/schema/duplicate,
   output-privacy, pool-pressure or unexpected-cost failure. Retain request
   receipts and reconcile committed operations. No blind replacement request,
   migration reset or rollback by deleting collected data.

Planning reserve: **USD1 incremental for this100-request dev gateway window**,
no actor/model fees. It is a conservative testing reserve, **not a platform
enforced invoice cap**. At current published `fra1` Fluid prices, active CPU is
USD0.184/CPU-hour and provisioned memory USD0.0152/GB-hour. Even a planning
allowance of two CPU units and1GiB for20s on each request is about USD0.213 before
invocations/transfer/builds. Actual deployment sizing, eligibility, transfer and
build charges must be checked before execution; unknown subscription fees remain
unknown. No paid feature/service upgrade or shared budget change is included.
[Current pricing](https://vercel.com/docs/functions/usage-and-pricing).

Rollback: set the dev route's enable flag off and unpublish only any owned
temporary callback used in a separately approved batch. Revert the adapter
selection to its previous inactive, TLS-blocked configuration; it does not
become a working fallback. Roll back the Vercel code to the reviewed prior
deployment while leaving the new private request receipts/schema dormant.
No destructive down migration, old version replay or shared credential change.
Revocation of the **new gateway** machine/bypass credentials is owner-controlled
and scoped to those new entries; do not touch unrelated shared workflows.

## Acceptance and exact approval wording

Required evidence after approval includes:

- Isolated bad-CA/hostname/expiry/self-signed denial; actual dev writer
  authentication with both identities; no postgres/service-key/SET ROLE path.
- Invalid/missing/cross-environment auth, foreign audience/host, unknown
  operation/keys and oversized/compressed inputs denied before DB dispatch.
- Shared limiter and global business admission tested across concurrent
  processes; pool/session-count and clean release/timeout evidence.
- Same-key same-args replay, different-args409, two simultaneous same-key calls,
  timeout-before/after-commit and interrupted execution prove durable outcomes.
- Retained local atomic item/result/cost/completion tests and new local settled
  cost/early registration/recovery tests; actual actor/item/cost completion is
  still the later foundation-smoke gate. Gateway tests alone cannot establish
  actual Apify/callback acceptance or authorize that separate batch.
- Preserved migration/data/logo/exclusion/advisor/type evidence and unchanged
  internal-schema exposure. Zero new secrets in logs, native execution
  snapshots, repository or exports, tested separately from incident remediation.
- New evidence labeled **gateway restricted-login acceptance**. Native Postgres
  failure remains recorded; relevant AC wording changes only under this approval.

Recommended owner reply:

> Approve GW-01 dev-only implementation and connection-design change as specified
> in strict-tls-connection-proposal-20261018.md: the fixed Next.js/Vercel worker
> gateway, new dev machine authentication and protected-preview access, the one
> additive dev admission/idempotency migration, inactive owned M03 adapters and
> the100-request/two-concurrent/30-minute dev acceptance window with USD1 reserve.
> Keep strict TLS and actual n8n_writer authentication. No production, shared
> credential rotation or unrelated workflow changes, actor/model calls,
> recurring activation, external notification, merge or M04.

This approval is separate from private incident identification/remediation and
from the later actor/multi-workflow acceptance packet. Until it arrives, no
gateway implementation/deployment, credentials or architecture switch occurs.

## Source check boundary

Current public documentation and exact runtime source were read on18 October
2026. The Supabase Markdown changelog endpoint rejected the reader's content
type; the [HTML changelog](https://supabase.com/changelog) was read instead. Its
October12 HTTP cipher notice explicitly excludes direct/pooler Postgres; it is
not a fix for this CA failure. Sources support feasibility, not account-specific
settings or a successful new connection. No unapproved live experiment was used.
