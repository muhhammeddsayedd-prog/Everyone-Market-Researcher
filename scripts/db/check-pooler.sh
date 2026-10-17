#!/usr/bin/env bash
# URLs remain in private process environments, never connection arguments or logs.
set +x
set -euo pipefail

pooler_environment="${EMR_POOLER_ENV:-dev}"
result=0

check_connection() {
  local role="$1" port="$2" uri="$3"
  local -a connection=()
  [[ -n "$uri" && "$pooler_environment" =~ ^(dev|prod)$ ]] || return 1
  command -v node >/dev/null 2>&1 && command -v psql >/dev/null 2>&1 || return 1

  # NUL-delimited fields preserve punctuation without eval, shell parsing or argv secrets.
  mapfile -d '' -t connection < <(
    EMR_POOLER_CHECK_URL="$uri" EMR_POOLER_CHECK_ROLE="$role" EMR_POOLER_CHECK_PORT="$port" \
      node --input-type=module 2>/dev/null <<'NODE'
try {
  const url = new URL(process.env.EMR_POOLER_CHECK_URL);
  const role = process.env.EMR_POOLER_CHECK_ROLE;
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const ssl = url.searchParams.get('sslmode');
  const valid = ['postgres:', 'postgresql:'].includes(url.protocol)
    && /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(url.hostname)
    && ['n8n_writer', 'api_agent'].includes(role)
    && new RegExp(`^${role}\\.[a-z0-9]+$`).test(user)
    && url.port === process.env.EMR_POOLER_CHECK_PORT
    && url.pathname === '/postgres' && !url.hash && password.length > 0
    && ['require', 'verify-ca', 'verify-full'].includes(ssl)
    && [...url.searchParams.keys()].length === 1
    && !/[\u0000-\u001f\u007f]/.test(user + password);
  if (!valid) process.exit(1);
  process.stdout.write([url.hostname, url.port, user, password, 'postgres', ssl].join('\0') + '\0');
} catch { process.exit(1); }
NODE
  )
  [[ "${#connection[@]}" == 6 ]] || return 1

  (
    unset N8N_WRITER_URL API_AGENT_URL EMR_POOLER_CHECK_URL PGSERVICE PGSERVICEFILE PGHOSTADDR PGPASSFILE
    export PGHOST="${connection[0]}" PGPORT="${connection[1]}" PGUSER="${connection[2]}"
    export PGPASSWORD="${connection[3]}" PGDATABASE="${connection[4]}" PGSSLMODE="${connection[5]}"
    export PGCONNECT_TIMEOUT=10 PGAPPNAME=emr-m01-pooler-check
    export PGOPTIONS='-csearch_path= -cstatement_timeout=15000'
    psql -X -w -q -A -t -v ON_ERROR_STOP=1 -v "environment=$pooler_environment"
  ) >/dev/null 2>&1
}

if check_connection n8n_writer 5432 "${N8N_WRITER_URL:-}" <<'SQL'
begin;
select current_user = 'n8n_writer' as correct_role \gset
\if :correct_role
select ops.start_run('M01-conn-test', null, 'manual', :'environment', 'cli') as run_id \gset
select ops.finish_run(:'run_id'::uuid, 'success')->>'status' = 'success' as finished \gset
\if :finished
rollback;
\else
rollback;
\quit 1
\endif
\else
rollback;
\quit 1
\endif
SQL
then
  printf 'n8n_writer: OK\n'
else
  printf 'n8n_writer: FAIL\n'
  result=1
fi

if check_connection api_agent 6543 "${API_AGENT_URL:-}" <<'SQL'
begin;
select current_user = 'api_agent' as correct_role \gset
\if :correct_role
select count(*) from api.competitors_v;
rollback;
\else
rollback;
\quit 1
\endif
SQL
then
  printf 'api_agent: OK\n'
else
  printf 'api_agent: FAIL\n'
  result=1
fi

exit "$result"
