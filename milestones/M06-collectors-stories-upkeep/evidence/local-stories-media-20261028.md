# M06 independent local stories/media slice — 28 October 2026

## Scope and provenance

Base M05 `3def97de4ce69169425adf8bcfaf1fe8697e9f60`; separate M06 worktree/branch, no M05 edits. Owner permits local implementation/tests/docs/ordinary draft delivery before website completion. No hosted write, capture, secret read, upload, schedule or notification.

Story fixtures are **synthetic contracts**. Current public docs were checked; unavailable examples and input/timestamp disagreements are in [fixture provenance](../../../n8n/normalizers/fixtures/instagram-stories-README.md). They prove no actual actor behavior, empty-summary shape, availability, plan suitability or coverage. Public projected payloads exclude whole profiles/private fields/video downloads; input is unmodified. Account/minute fallback comparison keys remain collision-prone and labeled.

## Working local path

`prepareStoriesDataSlayerResults` → existing normalized ingest schema/RPC as `n8n_writer` → actual local media queue/target RPC → `runMediaBatch` → actual Sharp conversion → mocked immutable capability/upload → actual `ops.save_media_asset` → outcome port → actual ack. Replay creates0 new items/no extra AI/media work. Duplicate messages share one upload; expiry, retry exhaustion, human locks, capability ownership, immutable conflicts and cancellation are covered. Already-saved pointers can be acknowledged after lost ACKs without transport.

Injected download/sign/upload/record ports are **not native Cloud integration**. The future downloader must enforce public DNS/IP, strict TLS, refused redirects and bounded image headers/bytes; lexical URL checks alone are insufficient. Hosted usage persistence, Storage capabilities, orphan reconciliation, native exports and callback registration remain unverified. No stub workflow is exported as working.

## Local verification

- Focused Vitest: `pnpm exec vitest run n8n/normalizers/stories.test.ts n8n/normalizers/media-worker.test.ts apps/web/server/media-thumbnail.test.ts apps/web/server/media-upload.test.ts packages/shared/src/media-contracts.test.ts` —152/152 pass, including the reviewed completed-ACK regression. Counts overlap earlier individual runs. SDK requests use mocked HTTP; actual Sharp uses locally generated images.
- Actual SQL: `EMR_M06_LOCAL_SQL_TEST=true pnpm --filter web exec vitest run server/m06-media-sql.integration.test.ts` —1/1 pass. Fixed public fixture127.0.0.1:60322; no supplied URL/stored credential. Missing definitions applied inside rollback only, no history mutation. Original local14-version/10-item/1-company baseline verified unchanged, client closed. This is SET ROLE contract proof, not hosted restricted-login proof.
- `supabase/tests/20_m06_media.test.sql` —42/42 pgTAP pass in rollback-only local forward transaction: target bounds, ACL/search_path, unsafe identities, exact owner/source/path/dimensions, human locks, immutable replay/conflicts and unchanged AI/queues. Earlier missing-pgTAP/missing-function RED failures are local qualification history, not hosted failures.
- Native qualifier: owned `emr-m06-schema-local` at127.0.0.1:60422, cached pinned Supabase PostgreSQL17.11. Read-only schema snapshot from original14-version fixture plus six exact definitions gives full20-schema state. No app rows/passwords copied or migration-history fabricated. CLI types exit0, security advisors exit0/0 findings, performance advisors exit0/0 findings; four-schema AST parity passes. Initial image bootstrap/ACL-tail failures resolved only in owned target. Original fixture unchanged; owned container removed/scratch deleted.
- Normal CI preserves earlier suites and requires new pgTAP plus M06 SQL/app test, fresh20-version replay, generated-type parity/advisors. Ordinary unit-mode skipped SQL suites are not database acceptance. Final changed-head checks are reported at delivery; M05's green CI is not reused as changed-code proof.
- Local typecheck, lint, format and production build pass. Client static chunks contain neither secret environment-variable name. Root `pnpm test` recorded1265 pass/14 fail/46 skipped:13 old Windows YouTube tests resolved a relative path from root rather than scripts, and one native private-runner fixture exceeded the default5-second timeout under parallel load. The supported package invocation `pnpm --filter @emr/scripts exec vitest run seed/youtube-diagnostic-runner.test.ts seed/private-runner.test.ts --no-file-parallelism` passes32/32 without source/policy changes. This does not rewrite the failed root result; Linux CI skips those Windows-only cases and cannot replace native Windows evidence.

Migration `20261028190835_m06_media_contracts.sql` SHA256 `c740eb1892e1e90d2c57c3621d1a593363169d04a090dad382b44476bcf14d41`.
Native types SHA256 `95f28f976c99eabc8857072f196f44979c818823b8c34cf136f1b9af99c459a5` (two media RPC additions only).

## Review and safety

Independent review found sibling closure, uncertain upload, duplicate-token, codec-format and completed-ACK replay issues. Each corrected with focused regressions. Strict test typing corrected without dropping assertions. No privileges/historical migrations/denied M05 code changed. Immutable upload prevents overwrite before SQL guards.409/lost upload/save remains unacknowledged for reconciliation. Infrastructure cost stays unknown/null, bytes visible.

Primary references: [signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [Supabase changelog](https://supabase.com/changelog), [Sharp resize](https://sharp.pixelplumbing.com/api-resize/), [Sharp JPEG](https://sharp.pixelplumbing.com/api-output/#jpeg), [GitHub branch filters](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request). Pinned cached SDK/Sharp dependencies; no global tool/skill install.

## Remaining gates and costs

M05 subset stays passed: six actors/USD0.28515; website and overall acceptance open. Prepared support report/earlier denial remain separate; no alternate route attempted. PR metadata403 is not a provider prerequisite.

M06:0 provider starts/calls/uploads, USD0 incremental provider spend. Local compute/shared service allocation unknown. No live credential child; encrypted entries preserved. Original19 hosted migrations, data and inactive Cloud definitions unchanged.

Next: finish local native media adapter, then qualify exact actor INPUT/output/no-stories on small real examples only under corresponding live authority. Hosted migration, Preview binding/upload and seven-day comparison excluded from this local exception. M06 open; no production/recurrence/email/merge.

## Actual delivery follow-up

Code pushed as `5b0926faf0129b68a01e2a51d97c937e53b19ace` on the separate M06 branch. Default Git Credential Manager stalled before publication; interrupted child ownership/timestamps were verified and the remaining owned credential child closed. Remote readback showed no branch before retry. Existing authenticated native GitHub CLI credentials then pushed successfully through Git's standard per-command credential helper; no new token/login or persistent Git configuration change. This was an authentication transport issue, not an enforced action denial.

The connected GitHub `create_pull_request` request (draft, base M05/head M06) returned HTTP403 `Resource not accessible by integration`, documentation path `/rest/pulls/pulls#create-a-pull-request`. No alternate CLI/browser/account metadata mutation followed. Branch push and required branch CI are independent permitted operations; PR14 remains unchanged. Exact stacked comparison/owner draft steps are in current progress. The M05 review-capability report stays available and its denied website edit is untouched.

CI40757385375 at that head: quality/unit/build/e2e successful and Vercel green; database safety regression stopped before stack creation because its synthetic TAP mock still emitted15 files. The runner correctly required16 including M06. Corrected the existing mock/phase list and added explicit skipped-M06 refusal and missing16th-suite failure; `node --test scripts/db/check-pooler.test.mjs` passes18/18 natively. This is an affected test-contract repair, not disabled CI or a new verifier. Normal changed-head CI remains required; preserve the first failure as historical and inspect the latest branch run for current delivery status.
