#!/usr/bin/env bash
# GitHub-hosted CI only: never reset an ordinary developer or hosted database.
set +x
set -euo pipefail

if [[ "${CI:-}" != true || "${GITHUB_ACTIONS:-}" != true ]]; then
  printf 'Local database CI runner requires GitHub Actions.\n' >&2
  exit 1
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
[[ -f supabase/config.toml ]] || { printf 'Local database configuration missing.\n' >&2; exit 1; }
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD N8N_WRITER_URL API_AGENT_URL
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSERVICEFILE
unset SEED_DATABASE_URL SUPABASE_SECRET_KEY VIMEO_TOKEN YOUTUBE_API_KEY M02_TEST_DATABASE_URL
if [[ "$(supabase --version 2>/dev/null)" != 2.121.0 ]]; then
  printf 'Expected the pinned Supabase CLI version.\n' >&2
  exit 1
fi

umask 077
private_log="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/emr-db-ci.XXXXXX")"
private_report="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/emr-db-ci-report.XXXXXX")"
trap 'rm -f -- "$private_log" "$private_report"' EXIT

run_private() {
  local label="$1"
  shift
  if "$@" >"$private_log" 2>&1; then return 0; fi
  printf '%s: FAIL (raw tool output withheld to protect credentials).\n' "$label" >&2
  return 1
}

run_private 'Local Supabase start' supabase start --exclude \
  realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
printf 'Local Supabase start: OK\n'
run_private 'Local database reset' supabase db reset --local
printf 'Local database reset: OK\n'
run_private 'pgTAP' supabase test db --local

# Emit only numeric TAP summaries. An empty/skipped or incomplete suite is not acceptance.
files=0 assertions=0 verdict=''
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  if [[ "$line" =~ ^Files=([0-9]+),[[:space:]]*Tests=([0-9]+), ]]; then
    files="${BASH_REMATCH[1]}"
    assertions="${BASH_REMATCH[2]}"
  elif [[ "$line" == 'Result: PASS' ]]; then
    verdict=PASS
  fi
done <"$private_log"
if [[ "$files" != 11 || "$assertions" -eq 0 || "$verdict" != PASS ]]; then
  printf 'pgTAP: FAIL (expected eleven files, nonzero assertions and PASS).\n' >&2
  exit 1
fi
printf 'pgTAP: %s files, %s assertions, PASS\n' "$files" "$assertions"

run_private 'Security advisors' supabase db advisors --local --type security --level warn --fail-on warn
printf 'Security advisors: no warnings or errors\n'
run_private 'Performance advisors' supabase db advisors --local --type performance --level warn --fail-on error
printf 'Performance advisors: no errors; warnings require the milestone review\n'

# These files use a fixed local test password only inside their owned Node clients.
# Seed/production-component fixtures roll back; owner-exclusion fixtures are SELECT-only CTEs in read-only transactions.
# Shared fixed fixture keys and lock upgrades require serial files. Explicit
# collector contention is verified separately by check-concurrency.mjs.
# An unset/invalid target or a missing/skipped test is not acceptance.
run_private 'M02 PostgreSQL acceptance' env \
  M02_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:60322/postgres \
  pnpm --filter @emr/scripts exec vitest run seed/seed-competitors.integration.test.ts seed/database.test.ts seed/owner-exclusions.integration.test.ts seed/prod-operations.integration.test.ts --no-file-parallelism --reporter=json --outputFile "$private_report"
node --input-type=module - "$private_report" <<'NODE'
import { readFileSync } from 'node:fs';
let report;
try { report = JSON.parse(readFileSync(process.argv[2], 'utf8')); }
catch { console.error('M02 PostgreSQL acceptance: FAIL (invalid private test report).'); process.exit(1); }
const expected = new Map([
  ['seed-competitors.integration.test.ts', 10],
  ['database.test.ts', 5],
  ['owner-exclusions.integration.test.ts', 21],
  ['prod-operations.integration.test.ts', 6],
]);
const files = report.testResults ?? [];
let assertions = 0;
for (const [name, minimum] of expected) {
  const file = files.find((item) => item.name?.replaceAll('\\', '/').endsWith(`/seed/${name}`));
  const tests = file?.assertionResults ?? [];
  if (tests.length < minimum || tests.some((item) => item.status !== 'passed')) {
    console.error('M02 PostgreSQL acceptance: FAIL (missing, skipped or failed assertions).'); process.exit(1);
  }
  assertions += tests.length;
}
if (!report.success || report.numFailedTests !== 0 || report.numPendingTests !== 0) {
  console.error('M02 PostgreSQL acceptance: FAIL.'); process.exit(1);
}
console.log(`M02 PostgreSQL acceptance: ${assertions} assertions, PASS`);
NODE
