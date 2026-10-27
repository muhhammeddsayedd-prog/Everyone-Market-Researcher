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
# Actor-admission concurrency needs an independent empty C999 namespace. This
# reset belongs only to this already-guarded ephemeral GitHub job. Ordinary
# resumes use --local --gateway-only and never reset or alter C999/Test House.
run_private 'Foundation no-seed fixture' supabase db reset --local --no-seed
printf 'Foundation no-seed fixture: OK\n'
run_private 'Foundation concurrent SQL' node scripts/db/check-m03-foundation-concurrency.mjs --ci
node --input-type=module - "$private_log" <<'NODE'
import {readFileSync} from 'node:fs';
let r;
try {r=JSON.parse(readFileSync(process.argv[2],'utf8'));} catch {console.error('Foundation concurrent SQL: FAIL (invalid bounded receipt).');process.exit(1);}
const required=['maxTwoReservations','overlappingDuplicateSingleSideEffect','committedResultRecoveredByReadback',
  'overlappingActorOnePostPermit','unknownOriginalPreventsAnotherLaunch','closedNeverReopens',
  'ownedFixtureRemovedAndBaselinePreserved','databaseClientsClosed'];
if(r.passed!==true || r.scope!=='ci-owned-no-seed-local-fixture' || r.actorConcurrency!=='executed' || required.some(k=>r.checks?.[k]!==true)) {
  console.error('Foundation concurrent SQL: FAIL (missing required observations).');process.exit(1);
}
console.log('Foundation concurrent SQL: PASS (owned no-seed fixture, eight observed checks)');
NODE
# SQL15 enforces the one-item M03 cap globally. Keep all three retained
# rollback suites in this owned no-seed phase; do not delete seeded baseline
# rows or weaken the production guard to accommodate test data.
foundation_suites=(supabase/tests/12_m03_launch_admission.test.sql supabase/tests/13_m03_foundation_gateway.test.sql supabase/tests/14_m03_foundation_boundaries.test.sql)
for suite in "${foundation_suites[@]}"; do [[ -f "$suite" ]] || { printf 'Foundation pgTAP: FAIL (missing suite).\n' >&2; exit 1; }; done
run_private 'Foundation pgTAP' env PGPASSWORD=postgres supabase test db \
  --db-url postgresql://supabase_admin@127.0.0.1:60322/postgres "${foundation_suites[@]}"
files=0 assertions=0 verdict=''
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  if [[ "$line" =~ ^Files=([0-9]+),[[:space:]]*Tests=([0-9]+), ]]; then files="${BASH_REMATCH[1]}"; assertions="${BASH_REMATCH[2]}";
  elif [[ "$line" == 'Result: PASS' ]]; then verdict=PASS; fi
done <"$private_log"
if [[ "$files" != 3 || "$assertions" -lt 173 || "$verdict" != PASS ]]; then
  printf 'Foundation pgTAP: FAIL (expected three files, at least173 assertions and PASS).\n' >&2; exit 1
fi
printf 'Foundation pgTAP: %s files, %s assertions, PASS (local session simulation)\n' "$files" "$assertions"
run_private 'Local database reset' supabase db reset --local
printf 'Local database reset: OK\n'
old_suites=()
for suite in supabase/tests/*.sql; do
  case "$suite" in
    supabase/tests/11_worker_gateway.test.sql|supabase/tests/12_m03_launch_admission.test.sql|supabase/tests/13_m03_foundation_gateway.test.sql|supabase/tests/14_m03_foundation_boundaries.test.sql) ;;
    *) old_suites+=("$suite") ;;
  esac
done
[[ "${#old_suites[@]}" == 14 ]] || { printf 'Expected fourteen SQL suites including M04 recent-monitoring contracts.\n' >&2; exit 1; }
run_private 'pgTAP' supabase test db --local "${old_suites[@]}"

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
if [[ "$files" != 14 || "$assertions" -eq 0 || "$verdict" != PASS ]]; then
  printf 'pgTAP: FAIL (expected fourteen files, nonzero assertions and PASS).\n' >&2
  exit 1
fi
printf 'pgTAP: %s files, %s assertions, PASS\n' "$files" "$assertions"

# The new session-principal guard is deliberately not weakened for SET ROLE.
# This fixture-only superuser harness simulates session authorization locally;
# it is not an actual hosted n8n_writer login receipt. No hosted secret is used.
run_private 'GW-01 pgTAP' env PGPASSWORD=postgres supabase test db \
  --db-url postgresql://supabase_admin@127.0.0.1:60322/postgres \
  supabase/tests/11_worker_gateway.test.sql
files=0 assertions=0 verdict=''
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  if [[ "$line" =~ ^Files=([0-9]+),[[:space:]]*Tests=([0-9]+), ]]; then
    files="${BASH_REMATCH[1]}"; assertions="${BASH_REMATCH[2]}"
  elif [[ "$line" == 'Result: PASS' ]]; then verdict=PASS; fi
done <"$private_log"
if [[ "$files" != 1 || "$assertions" != 102 || "$verdict" != PASS ]]; then
  printf 'GW-01 pgTAP: FAIL (expected one file,102 assertions and PASS).\n' >&2; exit 1
fi
printf 'GW-01 pgTAP: %s files, %s assertions, PASS (local session simulation)\n' "$files" "$assertions"

run_private 'Foundation SQL/app contract' env EMR_M03_LOCAL_SQL_TEST=true pnpm --filter web exec vitest run server/n8n-worker/foundation-sql.integration.test.ts --reporter=json --outputFile "$private_report"
node --input-type=module - "$private_report" <<'NODE'
import {readFileSync} from 'node:fs';
let r;
try {r=JSON.parse(readFileSync(process.argv[2],'utf8'));} catch {console.error('Foundation SQL/app contract: FAIL (invalid private report).');process.exit(1);}
const f=r.testResults?.find(v=>v.name?.replaceAll('\\','/').endsWith('/server/n8n-worker/foundation-sql.integration.test.ts'));
if(!r.success || r.numFailedTests!==0 || r.numPendingTests!==0 || !f?.assertionResults?.length || f.assertionResults.some(v=>v.status!=='passed')) {
  console.error('Foundation SQL/app contract: FAIL (missing, skipped or failed assertions).');process.exit(1);
}
console.log('Foundation SQL/app contract: PASS (actual rollback-only result decoding)');
NODE

run_private 'M04 SQL/app contract' env EMR_M04_LOCAL_SQL_TEST=true pnpm --filter web exec vitest run server/n8n-worker/collectors-sql.integration.test.ts --reporter=json --outputFile "$private_report"
node --input-type=module - "$private_report" <<'NODE'
import {readFileSync} from 'node:fs';
let r;
try {r=JSON.parse(readFileSync(process.argv[2],'utf8'));} catch {console.error('M04 SQL/app contract: FAIL (invalid bounded report).');process.exit(1);}
const f=r.testResults?.find(v=>v.name?.replaceAll('\\','/').endsWith('/server/n8n-worker/collectors-sql.integration.test.ts'));
if(!r.success || r.numFailedTests!==0 || r.numPendingTests!==0 || !f?.assertionResults?.length || f.assertionResults.some(v=>v.status!=='passed')) {
  console.error('M04 SQL/app contract: FAIL (missing, skipped or failed assertions).');process.exit(1);
}
console.log('M04 SQL/app contract: PASS (generated native code, HTTP and actual rollback-only SQL)');
NODE

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
