# M03 fixed-project read-only preflight

This is a read-only diagnostic under the existing M03 development authorization.
It does not renew A–D acceptance or reuse any spent project-read fence. The
owner's restored-session delivery has passed the separate bounded local
[saved-file metadata check](dev-acceptance-vercel-restored-metadata-20261022.json).
That local check does not establish the effective CLI backend, remote project
access or the cause of the historical failed GET.

## Exact operation

Use the existing pinned Vercel CLI, strict no-retry/no-refresh preload and
fixed-project transport for at most one GET:

```text
GET https://api.vercel.com/v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1
```

Before private access, verify the unchanged public Node/CLI/consumer sources,
the current closed-attempt/cleanup receipts and exact existing journals. Keep
all prior admissions, GET fences, source pins, migration/history evidence and
cleanup records unchanged. Hold the canonical parent mutex during the new
owned operation. Its new one-use ledger is:

```text
scripts/n8n/out/foundation/live/project-preflight-1c69c89e-7807-46d5-b7b8-ca28285ff2b4.jsonl
```

Creating this ledger consumes the new diagnostic fence. Recheck saved-file
expiry in its bounded metadata-only child; require actual closure and full
75-minute declared coverage before admitting the GET. A metadata failure
consumes the fence with zero GET attempts and unchanged request totals.

A durable GET intent precedes the CLI child. This adds one separate outside
management attempt: **5 → 6 management, control 201 unchanged, combined 206 →
207**. Keep the original ceilings 512/2048/2560 and all old raw journal prefixes.
The attempt stays charged on transport/authentication failure, even when no
HTTP response is observed. Do not confuse the attempted request with proof of
an actual wire response.

The GET has a strict bounded deadline and no retry, redirect, OAuth refresh,
configuration write or alternate endpoint. Return only the fixed seven-field
technical diagnostic, twelve boolean project predicates and owned-child closure
proof. Never emit an auth file, token, expiry value, raw stdout/stderr, headers,
provider error, response body, credential-derived length or hash.

Expected success is native exit 0, HTTP 200, all twelve project predicates true
and the actual owned CLI child's pipes closed. Keep the original expired-file
and failed-GET observations; a new pass does not prove their historical cause.
On failure or unknown closure, preserve the once-only intent and diagnostics;
do not replay the reader. An unresolved owned child retains the operation lock.

## Delivery and boundaries

The concrete consumer and tests are reviewed, checked locally and delivered
through normal PR #8 CI before its actual read. Public `CheckOnly` performs no
auth-file/DPAPI read and no network request. `ReadProject` is the one-use mode.

No administrator/writer/n8n/provider handoff or new key is needed. This check
creates no Preview, bypass, environment setting, database row, fixture,
workflow execution, gateway admission, actor run, recurring activation or
notification. Estimated collection is zero items and provider spend is USD0;
the existing USD2 actor reserve remains untouched. Production, private incident
execution, merge, M03 closure and M04 remain excluded. A–D still needs a separate
concrete time/fixture decision after its spent window; this diagnostic is not it.
