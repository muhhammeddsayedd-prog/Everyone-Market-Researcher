# M03 remaining attempt: local startup repair

The actual e803 admission is consumed and closed. Its preparation failed after
50 baseline GETs, with no new Vercel request, native execution, gateway call,
provider call or actor start. Aggregate accounting is management **4**, control
**151**, combined **155**. The original actor reserve remains USD2 and unspent.
The [actual attempt](dev-acceptance-remaining-attempt-20261022.json) is immutable;
its failed restoration/closure flags and missing wrapper receipt are preserved.

## Reproduced startup defect

The wrapper holds its public parent-lock file open using `FileAccess.Write` and
`FileShare.Read`. The new administrator ancestry function read that file through
`.NET File.ReadAllText`, whose default reader does not share incumbent write
access. Windows sharing checks are symmetric. The exact held-open arrangement
reproduces native **ERROR_SHARING_VIOLATION 32** before the administrator password
read. The earlier closed-file-only topology test missed this arrangement.

The dedicated public parent-lock reader now uses `FileAccess.Read` with
`FileShare.ReadWrite`, a 4096-byte ceiling, strict UTF-8 and the exact four-key
metadata schema. Its caller still checks the physical path, admission/claim,
native identities, process ancestry and creation times. Generic JSON/credential
readers and the wrapper's write handle remain unchanged. Actual native local
tests keep that handle open throughout: the old reader fails32, the corrected
reader passes, and attempts to open another writer or delete the lock still
fail32. Malformed/oversized/foreign-path input and disposal are covered.

This establishes a concrete, unavoidable defect in the reviewed held-lock path.
Because the historical fixed preflight output was discarded, it cannot exclude
an additional earlier blocker in that attempt. No historical password rejection
or successful database authentication is invented.

## Failure and closure evidence

The administrator client now brands only fixed startup diagnostics and actual
native closure metadata. Only an exact allowlisted pre-private line establishes
no DPAPI/authentication attempt. Raw stdout, stderr and exception messages never
become public diagnostics; malformed/additional output returns unknown.

The coordinator accepts that genuine projection, keeps its fixed code, and
releases the administrator transport sentinel only when the process physically
closed and either never spawned or proved a pre-private failure. Forged objects,
unknown authentication state and unclosed children remain unresolved. A failed
startup still reports residual and leaves all business/full-D flags false.

The external reader separately omitted `m03_acceptance_wrapper_closed` after
the source close frame. That omission did not cause preparation to fail. A new
public-only wrapper reader retains this final receipt across split/coalesced
output and never treats EOF or a missing receipt as closure. It does not launch
children, authenticate, send execution commands or grant window authority.
The missing historical receipt is not reconstructed from this correction.

## Verification of the repair

The focused combined run passed **71/71**, native0, with no skips (71e6f9).
It covers the administrator client and remaining proof, fixed startup failures,
native held-lock topology, remaining SQL/control guards, the coordinator's
existing clock/postcheck/resume and normal/error closure paths, exact local
cleanup and public wrapper reader. Independent reviews report no P1/P2 findings.
Their 33/7/11-test subsets overlap this run and are not added as unique tests.
No unchanged full local application/database suite was repeated.

All35 public database source pins and the unchanged14 migration/history records
were verified (1ab4ed). Only the current helper source hash changed in that
packet; baseline/pending version/history records and historical evidence did not.
Actual public seal590556 passes native0/privateRead:false/network0 with124project
and840runtime files. The spent continuation is not run again for a green result.
Normal delivery CI remains enabled and is separate from this local/public proof.

## Actual cleanup and remaining boundary

The [independent cleanup](dev-acceptance-remaining-cleanup-20261022.json) removed
exactly nine owned temporary leaves after public-journal, identity, process and
exclusive-handle checks. The six consumed runtime files, unused uninstalled
bypass and two stale locks are absent. No credential was decrypted by cleanup.
The unused encrypted administrator pair, original passwords/keys, Machine and
all historical fences/evidence remain preserved. The safe OS reconciliation has
an explicit unknown-orphan limit; it does not replace the missing wrapper receipt.

All 14 dev migrations and completed history/catalog/advisor/type evidence remain
unchanged. No migration operation, SQL window provision or C999 reactivation was
performed. Actual A–D and full-D criteria remain open. Production, recurring
activation, external notifications, private incident execution, merge and M04
remain untouched.

These repairs are local implementation work, not a renewal. Do not run the spent
remaining-mode child or request credentials to rediscover this failure. A future
concrete time-authority packet must preserve all prior attempts, admission/claim,
155 used requests and original aggregate caps, and must use a separately reviewed
one-use admission. No additional owner input is requested by this repair record.
