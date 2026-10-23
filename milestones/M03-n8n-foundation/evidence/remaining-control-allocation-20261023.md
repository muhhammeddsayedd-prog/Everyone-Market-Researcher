# M03 remaining Vercel request allocation — proposed, blocked

This is a request-budget decision, not a clock renewal, credential delivery or
another general M03 approval. Implementation, local tests and ordinary dev work
continue under the owner's standing authority. Production, merge and M04 remain
excluded.

The approved [A–D packet](live-acceptance-outline-20261018.md) explicitly keeps
Vercel's own **50-request subcap inside the 512 management maximum**. Its raw
setup journal records **44 actual requests** across the preserved attempts.
Only six remain. A new exact protected Preview needs14 fixed preparation
requests, up to12 build-status polls, and18 reserved cleanup requests. It cannot
fit the current subcap. The autonomy reset preserves request allowances; a
technical timeout or consumed credential is not the reason for this stop.

## Exact proposed change

Increase only the cumulative Vercel setup subcap from **50 to88**. Keep all44
already-used requests charged. Permit at most44 further Vercel requests:
14 fixed preparation, at most12 polls, and18 cleanup. This adds38 to the ceiling;
it does not reset the counter to zero or authorize88 new requests. The existing
consumer must retain synchronous per-request accounting, no automatic HTTP
retries/redirects/auxiliary account calls, and cleanup capacity before new work.

All aggregate ceilings remain unchanged:512 management,2048 control,2560
combined,120 native executions,256 gateway attempts,32 direct provider reads,
two sequential actor starts, USD1 each/USD2 total reserve, and at most one new
distinct collected item. Actual current management/control usage is98/301/399;
actors and spend are zero. The conservative remaining plan is44 Vercel requests,
up to25 read-only baseline checks,332 runtime management requests and up to three
WF-00 restore/readback requests if separately chosen:502 cumulative management,
leaving ten inside512. These are planning bounds, not prepaid usage or proof of
hosted completion; actual counters govern every request.

The already-approved sole/default bypass exception continues unchanged: one
owned temporary bypass at a time, empty initial map, exact dev Preview use,
revocation and verified absence. No production request/deployment or shared
credential change is added. Incremental actor/provider spending authority stays
USD2; subscription fees remain unknown where unknown.

The closed SQL window stays closed. The separate forward-only dev repair retains
its row,14 original migrations, IDs and counters and enforces cumulative limits
across owner-registered continuation windows. No fixture reactivation, migration
replay or new actor is implied by this allocation decision alone. Readiness stays
blocked at the current50 subcap until an actual owner decision is recorded.

Approval reply: **Approve the M03 cumulative Vercel subcap of88, retaining44 used
requests and all unchanged aggregate limits.**

The independent [WF-00 definition choice](wf00-drift-decision-20261023.md) is
also pending. It can be answered together: **Restore reviewed WF-00; approve the
cumulative Vercel subcap of88.** If its current changes are intentional, preserve
it and identify those changes instead. Neither choice requests secrets or a new
time window.
