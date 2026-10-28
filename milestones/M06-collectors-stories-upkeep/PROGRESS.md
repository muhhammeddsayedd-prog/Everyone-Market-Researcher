# M06 — Collectors III: Instagram stories + upkeep · PROGRESS

## Status

**In progress — independent local stories/media slice. M05 website and overall development acceptance remain open.**

| Field | Value |
|---|---|
| Started / last updated | 2026-10-28 |
| Branch / base | `m06-collectors-stories-upkeep` / M05 `3def97de4ce69169425adf8bcfaf1fe8697e9f60` |
| PR / delivery | Branch pushed at `5b0926f`; separate stacked draft creation returned GitHub403 `Resource not accessible by integration`. No alternate metadata mutation attempted. Keep PR14 unchanged. |
| Current task | Deliver local story normalization → restricted ingest/media queue → JPEG conversion → mocked immutable Storage → guarded SQL receipt/ack. |
| Next step | Required changed-head CI and draft delivery; then continue the local native media adapter. Shared callback/scheduler integration stays pending where it depends on M05 website completion. No live operation is admitted here. |

The explicit owner exception authorizes this local slice before M05 closes. It waives no original M06 criterion. Protected root/M03 records remain stale/untouched. The earlier denied M05 website correction remains unperformed; its [prepared support report](../M05-collectors-web-youtube-linkedin/evidence/review-capability-support-20261028.md) remains available. No repeated client-policy investigation or alternate edit route was used.

## Delivered local sub-tasks

- [x] Three public-only story normalizers, explicit ownership, timestamp/ID reconciliation, source-error rejection and cross-actor comparison projections.
- [x] Synthetic contracts;53 source tests including serialized Cloud-code execution and existing ingest-schema validation. Live captures/no-stories shape remain unobserved.
- [x] CLI-created media migration `20261028190835_m06_media_contracts.sql`, two private writer RPCs,42 rollback-only pgTAP checks, full20-schema native types/advisors. **Not applied to hosted dev**;19 applied hosted versions preserved.
- [x] Authenticated, opt-in exact-dev upload route;52 tests use actual pinned Supabase SDK over mocked HTTP. Production disabled, no secret bound/upload performed.
- [x] Bounded media queue engine, actual Sharp JPEG conversion, expiry/retry/ownership/immutable-conflict handling, byte accounting with unknown infrastructure charge, cancellation/child closure and completed-ACK replay safety.
- [x] Actual local SQL integration connects synthetic story → restricted ingest → queue/targets → actual codec → mocked sign/upload → guarded save/ack. Source replay creates no item/AI/media duplicates. Transaction rolls back and verifies the original local baseline.
- [ ] Normal changed-head five-job CI / ordinary protected build: reported on the separate branch/PR. CI adds M06 pgTAP and mandatory SQL/app integration without weakening earlier suites.

## Full milestone tasks and criteria

| Task / criterion | State and exact boundary |
|---|---|
| T1, AC1 story captures | Pending real public story/no-stories examples. No actor started. |
| T2 migration | Media RPC portion implemented/tested locally; bake-off, removal, cadence and health functions remain. No hosted application. |
| T3, AC8 route security | Local/mocked auth, strict paths, exact dev origin, capability integrity, bounded transport and secret isolation tested. Real Preview/Storage proof excluded from this local authorization. |
| T4, AC2 thumbnails | Queue engine/actual codec/SQL integration pass locally. Native public-DNS/strict-TLS/bounded-image downloader, gateway adapter and WF-31 export pending; no same-day live claim. |
| T5, AC3 bake-off | Normalizers/comparison projections only; registration, actor inputs/builds, bake-off RPC/report and seven-day comparison remain. |
| T6, AC4 removal / AC5 metrics | Pending; existing M04/M05 semantics preserved. No removal applied. |
| AC6 idempotency | Local source/SQL/media replay, immutable conflict, human locks and uncertain-upload behavior pass. Native capture/upload replay unverified. |
| T7, AC7 health | Pending. No email sent. |
| AC9 scheduling | Unchanged/inactive; cadence implementation/verification remain. |
| T8 production | Excluded; no migration/workflow/media backfill. |
| T9 exports/handoff | Local code/types/tests/docs delivered; native exports wait for connected definitions. No placeholder claimed as Cloud delivery. |

## Evidence and retained checkpoint

[Local evidence](evidence/local-stories-media-20261028.md) records exact environments, commands, hashes and limitations. No M05 file/workflow/runtime changed.

M05 retained subset: six actors/USD0.28515,19 applied migrations, successful restoration and closed runtime. Older failures, export/publication collision and PR-description403 remain separate. Website and overall M05 acceptance stay open.

M06 incremental provider usage: **0 actors,0 collection calls,0 Storage uploads, USD0 provider spend**. Local compute/shared infrastructure allocation unknown. Persistent encrypted originals were neither opened nor changed. Owned schema-only Docker qualifier stopped/removed; fixture SQL rolled back. No live credential-bearing child created.

## Decisions, dependencies and owner actions

- [Dated decision](../../docs/DECISIONS.md#independent-local-m06-slice--28-october-2026): local sequencing, public payload projection, immutable capabilities/receipts (`upsert:false`), dev-only opt-in, unknown infrastructure cost. No new framework.
- Completed SQL pointer/ACK replay skips transport even after delivery exhaustion. Existing object without settled SQL receipt,409 or uncertain upload/save remains for reconciliation; automatic orphan adoption not claimed.
- Route/queue contracts are independent of the denied website edit. Maintained WF-19/WF-00/SUB wiring waits where website correctness is a concrete dependency; do not clone the denied implementation elsewhere.
- No owner credential action needed locally. Future MA-20 binding/Storage, MA-16 actor choice, seven-day operation and production remain separate; do not request them merely to write/test local code.
- Record any delivery permission failure exactly; no alternate credentials/tools after denial. Draft PR creation uses the normal integration route.
- Actual draft-creation403 is a separate permission follow-up. Owner can use [the exact stacked comparison](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/compare/m05-collectors-web-youtube-linkedin...m06-collectors-stories-upkeep?expand=1) → Create pull request dropdown → Create draft pull request, retaining base M05/head M06. Alternatively restore the integration's Pull requests write permission through supported account controls. No repeat provider validation or secret replacement is needed. The exact managed client control was not observed; no permission policy was changed.

## Session log

- 2026-10-28 · Isolated branch from M05 `3def97d`; implemented stories/media contracts, route, codec, queue worker and two writer RPCs. Earlier migrations/M05 preserved. Focused SQL/contracts and zero-finding native qualification pass; strict test typing and reviewed completed-ACK edge corrected before delivery. Required changed-head CI next.
- 2026-10-28 · Pushed `5b0926f` using existing authorized native GitHub CLI credentials after closing the owned stalled Credential Manager child; no new login or persistent credential-config change. Draft API creation403 retained. CI40757385375 quality/unit/build/e2e pass and Vercel green; database job stopped before stack creation because the safety fixture still modeled15 suites. Updated its mock for16 suites/M06 app test and added skipped-M06 refusal:18/18 native safety tests pass without weakening actual checks. Normal changed-head CI remains required; query the latest branch run rather than treating the first failure or local tests as a current green receipt.
- 2026-10-28 · CI40758232944 passed quality/unit/build/e2e but failed the regular pgTAP phase. Isolated bootstrap-superuser runs passed, so native NOSUPERUSER reproduction was required: original20 test failed at static line53 SET ROLE (42501), after18 assertions. Added rollback-only writer/agent SET grants matching existing HC-01 fixture practice; no application/migration grant changed. Exact native postgres GREEN:42/42 M06 and663/663 across16 suites. All forward definitions/grants rolled back; baseline14/10items/1company, no media RPC and both SET memberships false verified. Owned qualifier container/scratch closed. Normal new-head CI next; historical failures remain.

## Hand-off

M06 is not Done/development accepted. Next local step: bounded native image/storage adapter and inactive WF-31 integration. Next real validation requires corresponding hosted migration/binding/upload authority and small explicit story/no-stories source samples after exact input/build readback; it must not implicitly start seven-day/recurring capture. M05 website review/correction/repeat/cost/cleanup remains separate. No merge/production authorized.
