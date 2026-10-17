# Targeted Supabase credential scan

Observed 17 October 2026. Synthetic fixtures only; no credential-store search,
network request or hosted authentication was performed.

`scripts/check-secrets.mjs` now detects Supabase PAT formats accepted by the
official CLI 2.121.0 and password-bearing `postgres://`/`postgresql://` URIs,
including percent-encoded userinfo and `password` query parameters. Existing
GitHub/OpenAI/Supabase-secret/private-key and tracked-env checks remain intact.
Only indexed content is scanned. Findings contain rule, path and line, never a
matching value. This remains a targeted check, not a complete credential audit.

Only explicitly named whole-value angle/square password placeholders and
`${VARIABLE}` references are allowed. Arbitrary angle-wrapped values are not
exempt. Named synthetic fixture passwords require a reserved test/example
hostname or loopback host as well. An arbitrary password on localhost is still
rejected; production-shaped hosts receive no fixture exemption, even in docs or
tests. Malformed encoding or host parsing cannot grant an exemption.

The standalone Node suite creates isolated Git indexes inside ownership-marked
temporary folders, without touching the project index or any credential store.
All synthetic matches and deliberately emitted private markers are checked to
be absent from scanner stdout and stderr. Cleanup verifies the resolved temp
parent and marker first. A first Windows harness attempt failed at `git init`
because Git rejected Node's Windows null-device path. That run proves no scanner
behavior. The harness now uses its own empty Git config file; eight leftover
marker-only folders from that failed attempt were verified and removed without
recursive deletion. Subsequent tests clean their fixtures automatically.

True red: the unmodified scanner passed the two existing/placeholder behaviors
and failed six new behavior tests (2/8 passed, exit 1). Green: the implementation
passed all eight (exit 0). After formatting and replacing the earlier pooler
test's literal synthetic password with a source placeholder, the combined
scanner/pooler regression run passed 16/16 in about eight seconds. No real DB or
network connection occurs in either suite.

Focused ESLint passed for scanner and both Node test files; Prettier processed
the maintained files. The scanner returned zero violations over the then-current
597 tracked files. That index snapshot predates root's final staging; run the
scanner again after staging all candidate files. After root's foundation commit,
the reviewer staged exactly the scanner, new scanner tests, pooler fixture
interpolation and CI workflow: the actual full-index scan then covered 599 files
with zero violations. No upstream skill/reference exception or pin change was
needed.

Independent review then identified two scanner gaps: arbitrary angle-wrapped
values were exempted, and splitting malformed userinfo before finding `@` could
erase a password containing raw `/`, `#` or `?`. Two new regression tests first
failed (8 passed, 2 failed); restricting the placeholder allowlist and inspecting
the complete credential-shaped userinfo made all ten pass. Focused ESLint and
Prettier passed again. After staging those fixes, the full index contained 635
files and returned zero findings. The final combined scanner/pooler run passed
18/18 in about eight seconds; focused formatting and staged whitespace checks
passed. The peer's final readback is pending at this checkpoint.
CI quality runs the scanner regression suite before the actual
tracked-content scan.

Source for PAT format:
[official CLI access-token validator](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/auth/access-token.ts#L6).
