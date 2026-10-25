# M03 migration classification review

Independent read-only review completed 2026-10-18T05:13:46Z. No hosted login,
migration, local database connection or provider call was performed.

Reviewed consumer SHA256:
`f03d1b6993193217e15ba9fb2bd6274a0bc329d84755b9a289885c0d4393eced`.
Reviewed test SHA256:
`56815df3b40dc37a9263b34f96ebc62dc90c557c9049fc82635f7f695d2f6aba`.

The narrow change classifies a dry-run response before interpreting its
contents: failure to start/close, nonzero native exit, output capture failure,
invalid JSON, invalid shape or exact pending-list mismatch. Public receipts
contain only fixed classifications and native exit status. Raw output and
credential-bearing errors remain suppressed. Every rejection keeps
`pushAttempted=false` and creates no migration admission marker.

Two new isolated synthetic Windows regressions passed independently:

```text
node --test --test-name-pattern='records a dry-run native failure|distinguishes malformed dry-run JSON' scripts/db/m03-dev-migrations.test.mjs
tests 2; pass 2; fail 0; skipped 0; native exit 0
```

The exact official CLI 2.121.0 source is now under `apps/cli` rather than the
historical Go push path. Its
[push core](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/db-push-core.ts)
emits the expected structured success fields (`upToDate`, `dryRun`, migration
basenames, seeds and roles), with the expected completion message. Its
[command](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/push/push.command.ts)
supports `--dry-run` and `--skip-vault`; the
[global flags](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/global-flags.ts)
support `--agent no`, `--output json` and `--output-format json`. No established
flag or success-shape mismatch was found.

No remaining P0/P1/P2 finding in this narrow classification change. This is a
diagnostic improvement, not a correction of the previous real dry-run failure.
The wrapper's original native exit was 1; the original dry-run child exit was
not retained, and its rejection cause remains unknown. The original seven hosted
versions were preserved, and no push occurred according to the root receipt;
this reviewer did not refresh that hosted state. Synthetic success and source
agreement do not establish that a future real dry-run will pass. Resealing is
required after any reviewed consumer change; no credential retry was made by
this reviewer.

## Subsequent output-protocol diagnosis and correction

The next actual root receipt established dry-run native exit 0 plus
`invalid_json`, before any push. The raw discarded response was not read or
reconstructed. A later source trace found the missing layer-selection boundary:
CLI 2.121.0 treats legacy `--output json` as a text-layer selection even when
`--output-format json` is also present. Query separately renders its own JSON;
push follows the selected layer and writes a human completion line instead.
Pure execution of the exact immutable source branches reproduced that conflict
without invoking the CLI or any database. The earlier generic first failure's
exact cause remains unknown.

The corrected consumer applies legacy `--output json` only to query. Push uses
only `--output-format json`; the strict parser is preserved. At consumer
`530b7a7395b980b13d77c0254206c6bf9ae65ba653bf7a359f71fd6c3438db35`
and test
`1a2322b304fbbb7c6cdda63b257897e08740d99bbc1ff7de956b7a1767b1a151`,
the reviewer independently ran the command-specific output regression and
malformed-JSON denial regression: **2/2 PASS, native0, no skips**. The synthetic
native CLI now models the upstream precedence, so its success path tests the
actual argument/output boundary. No remaining P0/P1/P2 finding in this narrow
fix. Public resealing remains root-owned; no private retry was made by reviewer.
See `cli-output-protocol-20261018.json` for immutable links, source hashes,
reproduction and the corrected-helper review receipt.
