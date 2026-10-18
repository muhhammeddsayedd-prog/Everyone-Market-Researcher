# Independent M02 implementation review

Observed: 2026-10-18 03:45 Cairo (00:45 UTC). Branch: `m02-seed-data`.
Repository HEAD at the final focused pass: `efd0855532bc3d846734e8de0099351f971546ec`.
The reviewed implementation was in the local working tree; this is not an exact-head CI or hosted acceptance claim.

## Scope and verdict

Independent adversarial review covered the owner-run seed planner/executor, manifest ownership, resolution orchestration, database compare-and-set operations, CLI lifecycle, local admission files, source-bound batch packet, build seal, and Storage boundary. The review followed `AGENTS.md`, M02's milestone/progress records, project skill rules, and `code-review-and-quality`.

All findings raised in this review are resolved in the inspected source. **No remaining P0, P1 or P2 finding was identified in the final focused review of scope admission and completion/reconciliation.** This verdict covers local implementation and the checks below. It does not close M02's live, owner-review or production acceptance criteria.

## Findings and reconciliation

| Finding raised | Severity | Resolution inspected |
| --- | --- | --- |
| Direct `databaseConfig('prod', ...)` could return production connection options despite the command-parser gate. | P1 | Both command parsing and direct configuration reject production. The reviewed private-runner receipt separately records its config/PowerShell tests. |
| Initially equal unmanaged fields gained future seed ownership after a missing receipt. | P1 | `mergeSeedFields` protects every desired field when prior ownership is absent. Added unit and PostgreSQL regressions cover a later changed CSV after initially equal unmanaged data. |
| Correcting an untouched invalid account retained `invalid` and prevented subsequent resolution. | P1 | An explicit owner replacement supersedes the old invalid identity, restores desired gating and clears stale resolution fields. Human paused/disabled choices remain protected. The added PostgreSQL regression exercises correction followed by an injected resolver. |
| Case-only YouTube channel-ID replacement bypassed identity reset through lowercase `handle_norm`. | P1 | Identity comparison uses the exact handle; LinkedIn kind changes also compare the URL. The PostgreSQL regression verifies cleared IDs and pending resolution after a case-only UC-ID change. |
| Resolution/website/logo failures could leave uncertain committed effects without a durable reconciliation gate; logo manifest failures were swallowed. | P1 | A global write marker wraps every mutating command. Uncertain adapter or manifest failures abort and retain admission. Safe content/download failures can be reported independently. |
| Check-then-write admission allowed concurrent children to replace each other's marker. | P1/P2 | Exclusive `wx` creation admits one writer; removal requires that child's run ID. Concurrent acquisition and foreign-marker preservation tests pass. |
| Reviewed source/volume estimates did not bind runtime public input bytes. | P1 before live execution | The packet binds the source digest, baseline SVG digest, fixed target and counts; the build seal includes CSVs, taxonomy, overrides, baseline and packet. The checked-in packet is still `approved: false`. |
| Credential-query screening missed malformed or scheme-less source URLs. | P2 | Lexical authority/query screening rejects the supplied malformed, scheme-less and encoded-key sentinel cases without reflecting their contents. |
| Database-wide readers could include extra unmanaged accounts/logos beyond approved plan volume. | P1 | `scopedAccounts` and `scopedLogos` require exact current-plan identity, manifest ownership and unchanged identity fields. CLI validates the manifest target and uses these filters before resolution, website checks and logo operations. Extra/unmanaged and human-edited rows are excluded. The fixed known-account credential probes remain separate, non-mutating requests. |
| The write gate released before shutdown and final receipt persistence. | P2 | `main` returns the releaser only after the report and `sql.end()` complete. `completeWriteBatch` persists final receipts before releasing admission. A completion-persistence failure leaves the marker and blocks a subsequent acquisition. |

The final Storage inspection also confirms create-only SDK uploads, a restricted verified-origin/path POST fetch with redirect following disabled, explicit object-missing responses rather than arbitrary 400s, actual public-byte verification before metadata completion, and no raw SDK error reflection. The pinned Supabase client is exercised against an injected fetch; this makes no HTTP request.

## Checks actually run by this reviewer

| Check | Observed result |
| --- | --- |
| `pnpm.cmd --filter @emr/scripts exec vitest run seed/config.test.ts seed/seed-competitors.test.ts seed/resolve-accounts.test.ts` (03:36 Cairo, earlier working-tree snapshot) | Exit 0; 3 files, 51 tests passed. |
| `pnpm.cmd --filter @emr/scripts exec vitest run seed/batch-packet.test.ts seed/files.test.ts seed/storage.test.ts seed/seed-competitors.test.ts` (03:41 Cairo, second-pass snapshot) | Exit 0; 4 files, 40 tests passed. |
| `pnpm.cmd --filter @emr/scripts exec vitest run seed/scope.test.ts seed/files.test.ts seed/storage.test.ts` (03:45 Cairo, final focused pass) | Exit 0; 3 files, 21 tests passed. |
| `git diff --check` (second and final passes) | Exit 0; no whitespace findings. |

Earlier passes were performed while other agents addressed findings. Their test totals are historical checks of those snapshots, not additional final-snapshot coverage. The final pass inspected the changed CLI call sites and lifecycle alongside the focused tests. No code-mutation experiment was performed in the concurrently edited worktree.

PostgreSQL regressions were inspected in `scripts/seed/seed-competitors.integration.test.ts`; this reviewer did **not** rerun database integration tests or the unchanged full suite. Broader unit, PostgreSQL, normalization/logo and PowerShell results belong to their separate implementer/reviewer evidence. In particular, this document does not relabel skipped integration cases as passes.

## Final reviewed source hashes

SHA-256 values below identify the final local snapshot inspected by this reviewer. Reformatting or later changes require a refreshed seal/check; these hashes do not claim later-byte coverage.

| File | SHA-256 |
| --- | --- |
| `scripts/seed/scope.ts` | `4a4a9d8ec82df0eff3770898ef459ee0515b4bcfe0447e52fb83bd6aec0fb689` |
| `scripts/seed/scope.test.ts` | `dc4a1d25b578c60cfd7b1bc133e62e333f5dd5d97cb35ae971fb41602a881dd5` |
| `scripts/seed/files.ts` | `e4aed54d005cdfbe50ad1e16c3e1e4aa23eaa8d28b620decfdd1563a13145a34` |
| `scripts/seed/files.test.ts` | `a2809dd526d4937b5f7dbc7a5e7fc73627218a02499e7cc00a62ad0e79482639` |
| `scripts/seed/cli.ts` | `8b968a14c3b8f8fd5ef0a4b9b044c2e3e80a648f18ffc9eb375463cfb4b825e0` |
| `scripts/seed/storage.ts` | `7fdf43ab10f1aae8084be89fe8368c2c2c409ed10fe59b0b8d4eac5bd7fc8ff5` |
| `scripts/seed/storage.test.ts` | `bab8e6f12d401fdb778ce63c65ac4625454572613701d3b5e45820ebabfb3b61` |
| `scripts/seed/seed-competitors.ts` | `f146b02d36b8ada6f42397a7a78a2cbb2d7788bba5890f7c6f87f2dd1c17ea88` |
| `scripts/seed/seed-competitors.test.ts` | `5b70a6bdd5d1acf9c1e2a6298c437c2a227baba88bcc548f035e3d614a44790b` |
| `scripts/seed/seed-competitors.integration.test.ts` | `7274a8c27e3a84e3c50de137caf59a5e746ed5b48dca286d60ad37a3fe118230` |
| `scripts/seed/batch-packet.ts` | `ab970975810fa20db0dc7d30c3d90c3e51688af6e2bd2656d9771cb805a8e3ab` |
| `scripts/seed/batch-packet.test.ts` | `e1b170725304fab4449a1add67ea8d7628034c0015d5ae2345d2f0bdd4dea3a3` |
| `scripts/seed/dev-batch-packet.json` | `7b82cf76e3af4cdb722a20cd07ff15b0fdcb20828b47c57e2cf3e82f840ef5b6` |
| `scripts/seed/build-runner.mjs` | `8b86b8e73a177bc12deacf4e435c692244f796de8508c03a26adeb6e8b3ccee9` |
| `scripts/seed/config.ts` | `469deea8086e93c342d1065bceef975baddc05bcd8f43d6e628ba10417f3f583` |

## Execution boundary

This review used local public source reads and injected/synthetic unit adapters. It did not read actual credential files, authenticate to a hosted database, contact Vimeo/YouTube/competitor sites/Storage, upload logos, write hosted data, alter approval, or run production. Live credential validity, provider quotas, public logo visibility, dev counts, MA-09 sign-off and dev/prod parity remain unverified by this review. The packet is unapproved; M02 live bulk and production gates remain open.
