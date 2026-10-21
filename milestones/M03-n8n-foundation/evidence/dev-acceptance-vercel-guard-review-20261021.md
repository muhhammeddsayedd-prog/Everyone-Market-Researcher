# M03 Vercel guard correction and bounded diagnostic — 21 October 2026

The local guard correction and its isolated regressions pass. The separately
bounded live project GET is **pending**. Local reproduction does not establish
the raw error from the earlier actual attempt or complete hosted acceptance.

## Preserved actual checkpoint

- [Actual replacement attempt](dev-acceptance-postcheck-attempt-20261021.json)
  remains immutable at SHA256
  `b984ec79c857468822e9299dd59fc2b26d71a26bb6b324dd90ecbaa7f39d1fcd`.
  Delivery head was `10e40c717a23445e03cf791171a3118406533b69`; application source
  remains `f42930f90c2de43c84f61ad6d966d0ee6074d70e`. Segment
  `a570212a-634c-444f-90a2-578ae47e8d27` was consumed once and physically closed
  with native exit1.
- Dev authentication, all14 migration fingerprints, fresh catalog/advisors and
  generated-type postchecks completed. No migration push/dry-run occurred. The
  owned C999 fixture was archived with its exact IDs; its data was retained.
- The attempt stopped during its first fixed Vercel project GET. Actual counts
  remain management1/control100/native0/gateway0/provider0/actor0. There was no
  Vercel write intent, new Preview, remote bypass, environment write, n8n change
  or SQL-window provision. The retained generic `BLOCKED` does not identify the
  historical CLI, auth, transport, HTTP or project-predicate layer.
- [Unused bypass cleanup](dev-acceptance-postcheck-unused-bypass-cleanup-20261021.json)
  separately records actual receipt `adf3cf`, native0, `deleted:true`,
  `absent:true`, no ciphertext-content read and no network. All eight consumed
  input/lease files and private scratch were already removed; credential-bearing
  children were closed. The retained Machine and saved original credentials are
  preserved. The original native1/full-D-false result remains unchanged.

## Deterministic local defects and correction

The installed CLI is pinned Vercel56.5.0. These failures were reproduced locally
with its real bootstrap and synthetic configuration, without a network call.

| Pinned native behavior | Defect in the earlier owned guard | Child-only correction |
| --- | --- | --- |
| `Client` constructor assigns its own `reauthenticate` field unconditionally (`chunk-3BHSS5E2.js:1641`). | An inherited non-writable refusal property makes construction throw before the project GET. | A protected accessor accepts the constructor assignment while installing the same sealed refusal on that instance. OAuth refresh remains refused. |
| Native Sentry instrumentation assigns wrappers to `http(s).get/request` (`cjs-DV4RM7XU.js:634/15212`). | Frozen value properties make those bootstrap assignments throw. | Protected accessors ignore wrapper assignments and continue returning the refusal function. Native HTTP entrypoints remain blocked. |

The correction is in
[the owned preload](../../../scripts/n8n/foundation-live-setup-no-retry.mjs).
It changes neither installed CLI files nor shared configuration. The exact
one-request fetch fence, method/path/host restriction, manual redirects,
zero retries, 429 bail-out, disabled auxiliary/auth-refresh calls and normal TLS
verification remain in force. Ignoring instrumentation assignments does not
install or execute those wrappers.

The same child also prevents incidental persistence. Its filesystem adapter
permits reads and an inert `mkdir` check of an existing ordinary directory, but
refuses file creation, writes, migration, mutation and deletion. Its pinned
credentials-store loader permits `getPassword` while rejecting keyring
`setPassword` and `deleteCredential` before either native mutation is called.
These are process-local guards; no global filesystem permissions, keyring,
saved credential, account setting or shared budget was changed.

## Local verification and its limits

The focused group covers
[transport](../../../scripts/n8n/foundation-live-setup-transport.test.mjs),
[predicate diagnostic](../../../scripts/n8n/foundation-live-setup-diagnostic.test.mjs),
[installed-CLI isolation](../../../scripts/n8n/foundation-live-setup-native.test.mjs)
and [post-close fencing](../../../scripts/n8n/foundation-live-setup-postclose.test.mjs).

- Initial meaningful RED `58ea3a` reproduced the installed constructor failure;
  unit RED `6f7781` preceded GREEN `58d099` for the narrow correction.
- Author run `ebc18c`:34/34 pass, native0, zero skips. Independent run
  `b9069a`:34/34 pass, native0, zero skips. Formatting/lint/diff checks passed
  (author format070bc5/lintc33a00/diff22b7fb; root lint559f4a). These are
  overlapping verification runs, not68 distinct cases.
- Final native-only regression after the explicit keyring-load fence:
  author `7881ae` and independent `7133bf`, each3/3 pass with zero skips. The
  native cases are included in the focused group, not additional coverage.
- Native cases use an owned `--global-config` directory, synthetic auth with
  valid/missing identity/expired variants, and a mocked fetch. The valid case
  performs exactly one mocked GET with matching synthetic authorization; the
  other two perform zero fetches. Real network entrypoints and credential-store
  fallback outside the fixture are fenced. Actual native keyring loads are0.
  The fixture's auth/config/device/session files remain byte-identical.
- Separate adapter regressions verify keyring mutation refusal and filesystem
  write refusal. They do not claim a successful read of the owner's keyring or
  saved session. No owner credential, default auth configuration or actual
  project response was used by the synthetic cases.

The concrete
[transport](../../../scripts/n8n/foundation-live-setup-transport.mjs) now exposes
only bounded technical diagnostics: fixed stage/code, child start/close,
native exit, byte counters, HTTP status and abort state. It does not expose raw
stderr, response bodies, headers, tokens, account identities or arbitrary error
codes. The
[project reducer](../../../scripts/n8n/foundation-live-setup-diagnostic.mjs)
returns fixed booleans for project/team identity, root, Node/framework,
GitHub linkage, deployment protection and absence of an existing bypass.

The local defects explain a reproducible incompatibility in the old guard.
They are **not historical raw-error proof**. The immutable actual failure must
not be rewritten as a confirmed constructor, instrumentation, auth or HTTP
failure.

Official references already reviewed by root:
[CLI global options, including `--global-config`](https://vercel.com/docs/cli/global-options)
and [global configuration](https://vercel.com/docs/project-configuration/global-configuration).
The documented option supplies the isolated test configuration directory;
tests do not substitute it for the owner's live saved state.

## Separately bounded post-close read

[The post-close entrypoint](../../../scripts/n8n/foundation-live-setup-postclose.mjs)
can perform only this one fixed GET:

```text
GET /v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1
```

Its immutable attempt/cleanup pins, dead prior PIDs, absent parent/runtime locks,
removed unused bypass and unchanged management1/control100/setup1-GET checkpoint
must verify first. It acquires the canonical parent lock and writes a durable
one-use diagnostic ledger before the child request. A failed or ambiguous
response leaves that fence; it cannot authorize another GET. Unknown physical
closure leaves the visible operation lock.

The allowance is one request with a20-second request deadline. It conservatively
reserves aggregate ordinal3/512: one failed original CLI GET, one separate
post-close MCP metadata attempt that returned unavailable, and this prospective
GET. The original management journal stays at1; the separate ledger carries
the aggregate accounting. This does not reset counters, renew an A–D clock,
consume administrator/writer/provider handoffs, provision a resource, replay
prepare or authorize an actor/workflow start.

Actual public CheckOnly receipt `ea9f91` passed with
`postclose_project_read_ready`, aggregate3/512, requestMaximum1,
requestTimeoutMs20000, `privateRead:false`, network0. This is public readiness,
not an authenticated endpoint receipt. Corrected-source commit/push and normal
CI are separate delivery gates before the live diagnostic.

## Actual diagnostic — pending

No live diagnostic `Run` result is recorded here. Root will add a separate
actual-result artifact after execution, without modifying the immutable attempt
or cleanup records. Required fields are:

- Delivered correction head and normal CI reference.
- Actual Run tool receipt/observation time, native exit, child closure and
  fixed transport stage/code/HTTP status.
- Predicate booleans if an actual HTTP200 response passes bounded parsing;
  otherwise the exact non-secret unresolved layer or failed predicate.
- Durable diagnostic-ledger/result reference and aggregate3/512 accounting,
  with the original journals and consumed admission preserved.
- Any genuinely missing saved-session action, or the next concrete reviewable
  recovery packet. No live acceptance, credential readiness, new time authority
  or replay is inferred from the local guard tests or public CheckOnly.

Production, recurring activation, notifications, shared credentials, private
incident work, PR8 merge, M03 closure and M04 remain outside this correction.
