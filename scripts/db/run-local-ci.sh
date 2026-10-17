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
if [[ "$(supabase --version 2>/dev/null)" != 2.121.0 ]]; then
  printf 'Expected the pinned Supabase CLI version.\n' >&2
  exit 1
fi

umask 077
private_log="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/emr-db-ci.XXXXXX")"
trap 'rm -f -- "$private_log"' EXIT

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
if [[ "$files" != 10 || "$assertions" -eq 0 || "$verdict" != PASS ]]; then
  printf 'pgTAP: FAIL (expected ten files, nonzero assertions and PASS).\n' >&2
  exit 1
fi
printf 'pgTAP: %s files, %s assertions, PASS\n' "$files" "$assertions"

run_private 'Security advisors' supabase db advisors --local --type security --level warn --fail-on warn
printf 'Security advisors: no warnings or errors\n'
run_private 'Performance advisors' supabase db advisors --local --type performance --level warn --fail-on error
printf 'Performance advisors: no errors; warnings require the milestone review\n'
