# Local M01 verification

Observed17October2026 on branch `m01-supabase-foundation`.

| Check                           | Observed result                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Seven-migration reset with seed | Exit0; exact versions and counts in local-inventory.json                                                                          |
| pgTAP                           | Ten files,242 assertions, PASS; pgtap-final.log                                                                                   |
| REST and Auth boundary          | Member/nonmember, four hidden schemas and disabled email signup pass; local-data-api-with-signup.json                             |
| Concurrent collectors           | Four actual two-session scenarios pass; known-PID blocking barriers, cleanupOK                                                    |
| Probe cleanup hardening         | Twelve negative cases rejected, clean case allowed; hung owned child bounded; local-concurrency-hardening.json                    |
| Local advisors                  | Zero warnings/errors;63 unused-index INFO and11 internal deny-all RLS INFO retained with rationale                                |
| Generated types                 | Regenerated app/api/ops/ingest after final replay; formatted and exported through shared package                                  |
| TypeScript                      | Strict shared/web/root checks pass, including generated types                                                                     |
| ESLint and Prettier             | Pass on maintained source, scripts and active M01 records                                                                         |
| Unit tests                      | Five files,39 assertions, PASS                                                                                                    |
| Script regressions              | Scanner10 plus pooler/CI8, all18 PASS; synthetic processes, no hosted connection                                                  |
| Next.js build                   | Pass; existing placeholder routes prerendered                                                                                     |
| Indexed secret check            | 634 files, zero violations before final documentation staging; final receipt in PROGRESS                                          |
| Dependency audit                | Production0 vulnerabilities; full audit retains the existing unpatched dev-only braces high advisory GHSA-vfj7-8cjw-p6xm from M00 |

Raw pgTAP/failure/mutation logs keep their original bytes through scoped Git
attributes; their trailing whitespace is tool output. Historical failures,
the initial concurrency receipt and corrected outcomes remain separate.

Local results do not establish hosted migration parity, hosted advisors,
pooler authentication, Google sign-in or production readiness. GitHub CI and
the hosted/manual gates are tracked separately in M01 PROGRESS. The local
Google provider is not enabled or simulated; the accepted negative probe is
email signup rejection only. The web UI was unchanged by M01; its browser
suite runs again in GitHub CI.
