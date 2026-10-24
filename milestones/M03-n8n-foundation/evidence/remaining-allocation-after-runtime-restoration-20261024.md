# Remaining M03 dev request allocation after technical13 restoration

Status: proposed, not approved or consumable. This packet requests only two
cumulative request ceilings. The standing M03 development authorization
continues; no credential delivery or time-only approval is requested.

## Actual restored state

The [original failed technical13 attempt](dev-acceptance-technical13-reconciliation-20261024.json),
SHA256 `226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983`,
remains immutable, including its failed restoration flags and pending second
SUB-NOTIFY settings-only PUT. Its original HTTP acknowledgement was not
retained and remains unknown. No successful operation or paid start is replayed.

The [separate three-GET saved-state readback](runtime-reconciliation-readback-20261024.json),
SHA256 `f03218c0f734e81d153b5123a9a8edc662b0dc1796f434e0a352a95c46575bdc`,
qualified the current owned Machine metadata and the exact SUB-NOTIFY/WF-90
settings, graph, version and publication states. It did not recover the missing
original acknowledgement or read credential data.

The following later receipts establish completed cleanup independently of the
failed attempt:

| Actual receipt                                                       | SHA256                                                             | Verified result                                                                                                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Runtime restoration](runtime-restoration-20261024.json)             | `365c8bb069e6f7246c89261fb543b8fa9dbd8f38587500da64d5f4d38e065946` | Native0; 38 Management requests; 50 metadata-only Control GETs; inactive baseline and Machine domain restored; zero execution candidates; children and transports closed; original runtime journal unchanged. |
| [Fixture archive](runtime-restoration-fixture-archive-20261024.json) | `37c3f0dc518799700cde6c56f18569634c33b919ba26b4bbac1e6d2d09baa656` | Native0; owned C999 archived/account paused; all four prior SQL windows closed; no active lease, pending launch, actor run, collected item or cost; no migration operation.                                   |
| [Final local cleanup](runtime-restoration-cleanup-20261024.json)     | `50b274b1f6e26d6ba34b602c2cae45136aea19353073d185a1b25ba4b9cc016a` | Native0; all ten disposable leaves and parent/runtime locks absent; temporary bypass deleted; four persistent dev originals and retained Machine custody preserved.                                           |

Restoration used a fresh qualified read to reconcile the pending settings save;
it did not replay that PUT. The final audit and execution-metadata sweep are
cleanup evidence, not completed A-D business acceptance. The actual restoration
used the independently reviewed, sealed working tree; its receipt distinguishes
that source from the earlier committed-helper CI evidence.

All fourteen earlier dev migrations and the approved fifteenth migration retain
their versions and hashes. Complete fifteen-version history was verified before
the archive; the archive receipt does not claim an additional post-archive
history query. M02 competitors, accounts, exclusions and logos are preserved.
These restoration and archive operations did not delete collected data or add
fixtures.

All four prior SQL windows remain permanently closed:

- `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`
- `38b3708d-61b0-41d2-8170-5ed91c66b4dc`
- `eda4fae1-1e19-47db-81b8-beac1a4ed883`
- `3c46c791-e140-4eb9-890a-eecfa251f65e`

## Exact requested ceilings

Every charged request remains charged, including failed or uncertain attempts.
The three diagnostic reads and subsequent restoration/settlement are included:
483 + 3 + 38 = **524 Management**; 791 + 50 = **841 Control**;
**1365 combined**. Vercel remains **149**, included in Management. Actors remain
**0 used of 2**.

| Pool                           | Already charged | Current ceiling | Proposed ceiling |
| ------------------------------ | --------------: | --------------: | ---------------: |
| Management, including Vercel   |             524 |             832 |         **1024** |
| Vercel, included in Management |             149 |             176 |          **224** |
| Control                        |             841 |            2048 |             2048 |
| Combined Management + Control  |            1365 |            2560 |             2560 |

The remaining conservative Management plan is unchanged:

| Remaining work                                        | Maximum additional Management requests |
| ----------------------------------------------------- | -------------------------------------: |
| Fresh saved-definition baseline                       |                                     25 |
| Protected dev Preview setup, verification and cleanup |                                     44 |
| Runtime setup, including fresh Machine conflict read  |                                    110 |
| 24 selected draft saves with fresh pre/post reads     |                                     72 |
| Two Machine credential readbacks                      |                                      2 |
| Restoration and final 25-workflow audit               |                                    124 |
| **Further requests**                                  |                                **377** |
| Already charged                                       |                                    524 |
| **Conservative cumulative Management total**          |                                **901** |
| Proposed Management ceiling                           |                               **1024** |
| Reserve above that plan                               |                                **123** |

Vercel reaches at most 149 + 44 = **193**, leaving **31** under the proposed
224 subcap. That reserve is a subset of the 123 Management reserve, not an
additional pool. The existing ceilings leave only 308 Management and 27 Vercel
requests, which cannot fit the unchanged 377/44 plan with cleanup.

Control remains capped at 2048, and every admission still enforces
`Management + Control <= 2560` in both directions. At 1024 Management, the
effective Control maximum is **1536**. Approval does not permit spending both
independent maxima together. Reserve covers only bounded, reconciled recovery
within the existing scope while retaining cleanup capacity; it does not permit
blind mutation replay or an uncertain paid start.

## Unchanged scope and conditions before continuation

- Dev project `zmotjsbzhzjvpelxvxlf` and the existing owned M03 workflows only.
  No production operation, migration replay or new migration authority,
  recurring schedule, external notification, R2 action, shared credential
  rotation, PR #8 merge or M04.
- Native executions remain 120; SQL gateway admissions remain 256; direct
  provider GETs remain 32. Existing zero-actor error, domain, privacy and
  settlement checks still precede smoke acceptance.
- Actors remain at most two sequential approved starts, USD1 each / **USD2
  existing total reserve**, and at most one new distinct item. No actor or
  spending allowance is replenished. Incremental provider allowance/cost from
  this request-ceiling change is **USD0**.
- Reuse the four persistent CurrentUser-DPAPI dev originals, retained Machine
  custody and existing authorized native integrations. No credentials are
  missing for this packet; no new input, reset, rotation or time renewal is
  requested. Administrative credentials remain separate from runtime inputs.
- Preserve the original technical13 plan, all prior journals, side-effect IDs,
  usage and closed attempts. The next existing continuation profile must carry
  the qualified restored SUB-NOTIFY/WF-90 versions, technical13 fixture audit
  and verified archived state. Never substitute the older baseline versions,
  reopen a closed window or overwrite legitimate later work.
- Before admission, reconcile the new receipts/counters, implement the approved
  ceilings and restored-state profile in the existing consumers, validate the
  applicable source/window and vacancy guards, then pass targeted local/native
  tests, independent review, source seals/public CheckOnly and normal exact-head
  PR CI/Vercel checks. No new framework or replacement helper family is needed.
  This allocation packet itself admits or opens no window.
- Retain the approved temporary sole/default bypass scope and verified removal,
  synthetic execution-retention conditions, least privilege and protected dev
  Preview restrictions. Keep PR #8 draft while A-D acceptance is incomplete.
  Actual expiry, revoked access, unsafe ambiguous side effects, exhausted limits
  and consequential decisions remain genuine boundaries.

Exact owner decision:

**Approve Management1024 and Vercel224; retain all charges and other limits.**
