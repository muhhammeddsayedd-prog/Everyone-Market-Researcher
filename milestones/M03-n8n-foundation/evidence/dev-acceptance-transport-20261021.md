# Actual zero-setup attempt and bounded transport continuation

This extends the existing approved A–D checkpoint. It does not approve or prove
any additional hosted operation. Application source remains f42930f; delivery
025b1a8 passed CI39507084987 (all five jobs) and Vercel.

## Actual first attempt

- Owner reported all four handoffs ready. Presence/lease checks passed.
- Non-TTY wrapper tool session18155 closed stdin. Node emitted ready at original
  deadline1792584023481, then received EOF. No prepare command was sent.
- Actual closed receipt recorded management0/control0/native0/gateway0/provider0.
  All remote acceptance/restoration flags were false. No administrator child
  was started, and no administrator password was decrypted.
- Node emitted logical closure but retained stdin. Public process ownership
  reconciliation identified Node64504/parent28976/ownedconsole53192 and matching
  creation times. Exact owned process-tree termination succeeded native0.
- Wrapper4789ee then finished native1 with childClosed:true,
  credentialChildrenClosed:true, handoffsDeleted:true, bypassHandoffDeleted:false.
  That native1 is a failed coordinator attempt, not a password rejection.
- Three runtime DPAPI/lease pairs were consumed and deleted. Administrator pair
  and retained encrypted Machine are untouched. No remote calls, SQL, API writes,
  migrations, native executions, actor starts or Preview creation occurred.
- Management journal is the exact original header only. Other setup/control/
  runtime journals and DB push/provision/readback artifacts are absent/empty.
  The minimal immutable proof is
  [dev-acceptance-zero-setup-20261021.json](dev-acceptance-zero-setup-20261021.json),
  SHA256 `6af79fc35a6e71fb323ca262092cfe015fd26a3422f5ce43b140f92caba1a28d`.

The newly generated encrypted local bypass was never sent to Vercel and has no
remote authority. Automatic approval review rejected its exact deletion before
execution, with generic reason “blocked by policy.” It remains for the exact
owner cleanup in the existing handoff record. No alternative deletion was tried.

## Local corrections and evidence boundaries

Actual isolated Node subprocess tests reproduced logical-close/physical-hang
(9a728d) and verified stdin pause on normal and rejected input (5100e6).
Credential-free actual TTY input probe9c2878 completed native0.

The Windows custody regression53470 then exposed a second local issue:
Console.In.ReadAsync can block synchronously before returning its task. The
coordinator waited for parent input before relaying child-ready. Offloading that
bounded line reader with Task.Run fixes the boundary; actual isolated custody
complete561e40 and independentc36a6c pass native0. These fixtures use synthetic
DPAPI values/scripted children, never live credentials or hosted acceptance.

The corrected consumer challenges the actual transport with a public random
nonce before private reads. EOF, malformed ACK or30-second silence blocks without
consuming handoffs. Child stdin is paused at normal/early closure; no process.exit
or forced physical-closure claim replaces real child exit.

Explicit SessionResumeZeroSetup requires the exact pinned closure proof,
original management header/source/window/deadline, no attempts or setup artifacts,
and no runtime lock. A branded proof cannot be copied by caller input. The
resume path never creates, deletes, replaces or resets the journal/counters.
Checks repeat under the parent lock and immediately before DPAPI. Administrator
public CheckOnly and its child receive the same original clock. Normal Session
and normal75-minute lease admission retain their existing behavior.

The original UTC boundaries are immutable:

| Boundary | UTC |
| --- | --- |
| Stop new work | 2026-10-21 11:50:23.481 |
| Action deadline | 2026-10-21 12:00:23.481 |
| Physical child-close ceiling | 2026-10-21 12:10:23.481 |
| Existing administrator lease must cover through | 2026-10-21 12:15:23.481 |

Source, independent review, affected tests and public seal are delivery evidence.
Actual PhaseA/B, domain denial, actors, SQL/provider settlement and PhaseD remain
unperformed. If the original stop boundary arrives, do not consume another
handoff or manufacture a fresh window. Preserve the actual checkpoint and stop.

Production, recurring schedules, external notifications, shared credentials,
private incidentR2, PRmerge/M03closure and M04 remain untouched. GW01 stays closed.
