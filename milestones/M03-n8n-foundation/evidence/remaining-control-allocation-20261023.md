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


## 23 October2026 execution update - original proposal preserved

The original proposal, historical502 planning calculation and its earlier
WF-00 question above are preserved unchanged. The owner subsequently approved
WF-00 restoration, and [actual verification](wf00-restore-verified-20261023.json)
87a22f/native0 now closes that definition decision. No repeat restore approval,
credential handoff or time-window question is needed.

The preserved first attempt used one safely closed GET and encrypted backup.
The verified continuation used a fresh GET, exactly one inactive PUT and a
final GET. All four actual restore calls remain charged: current usage is
102 management /301 control /403 combined, with carried Management10. The old
two journal rows remain byte-identical, and both private backups are retained.
Actors/spend remain zero; the existing two-start/USD2 reserve is unchanged.

The current conservative remaining envelope is102 already used +44 Vercel
requests +25 baseline checks +332 runtime requests =503 of512 management,
leaving nine requests. This is a planning maximum, not new usage or proof of
remaining A-D acceptance. No allowance is replenished.

The requested allocation remains exactly50 to88, retaining44 already charged
Vercel requests; that separate owner decision is still pending. The current
source subcap remains50 and refuses before private initialization/hosted setup
when the proposed work cannot fit. All original aggregate, actor and spending
limits, closed-window history, production and merge boundaries remain.


## 23 October2026 owner allocation approval - request decision complete

The owner replied exactly **Approve cumulative88; keep44 charged** to the
original df4b539 proposal. The [immutable approval receipt](remaining-control-allocation-approval-20261023.json)
records that literal decision and original source commit. The historical
proposal, original502 calculation, earlier question and preceding execution
update remain unchanged above; their pending wording is not a new owner request.

Only the cumulative Vercel setup maximum changes50 to88, retaining44 already
charged and permitting at most44 further setup requests. Prior actual usage
102/301/403 and the conservative503/512 remaining-plan calculation stay as
recorded. All global512/2048/2560, actor2/USD2 and other original limits remain.
No counter, actor or spending allowance is replenished.

There is no further allocation, credential or time-window owner action. The
existing consumers must validate the approval, retain synchronous accounting
and cleanup reserves, then pass actual readiness before remaining M03 dev A-D.
This decision does not establish hosted acceptance or approve production,
recurring activity, external messaging, merge or M04.
