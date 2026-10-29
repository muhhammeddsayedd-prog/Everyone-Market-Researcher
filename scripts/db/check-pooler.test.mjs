import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const marker = 'synthetic-output-must-stay-private';
const fixturePassword = 'synthetic-pass';
const writerUrl = `postgresql://n8n_writer.testref:${fixturePassword}@aws-0-test.pooler.supabase.com:5432/postgres?sslmode=require`;
const readerUrl = `postgresql://api_agent.testref:${fixturePassword}@aws-0-test.pooler.supabase.com:6543/postgres?sslmode=require`;
const bashPath = (path) =>
  path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
const quotedNode = "'" + bashPath(process.execPath).replaceAll("'", "'\\''") + "'";

function fixture(run) {
  const allowedRoot = realpathSync(tmpdir());
  const directory = mkdtempSync(join(allowedRoot, 'emr-pooler-test-'));
  writeFileSync(join(directory, '.owner'), 'emr-pooler-test');
  const stub = `#!/usr/bin/env bash
set -eu
if [[ "\${0##*/}" == pnpm ]]; then
  printf '%s\\n' "$*" >> "$EMR_TEST_CAPTURE/commands"
  if [[ "$*" == *'foundation-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != foundation-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_FOUNDATION_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/n8n-worker/foundation-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_FOUNDATION_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  if [[ "$*" == *'collectors-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != m04-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M04_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/n8n-worker/collectors-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_M04_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  if [[ "$*" == *'m05-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != m05-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M05_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/n8n-worker/m05-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_M05_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  if [[ "$*" == *'m06-media-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != m06-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M06_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/m06-media-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_M06_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  if [[ "$*" == *'m06-stories-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != m06-stories-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M06_STORIES_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/n8n-worker/m06-stories-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_M06_STORIES_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  if [[ "$*" == *'m06-upkeep-sql.integration.test.ts'* ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != m06-upkeep-app ]] || { printf '${marker}\\n'; exit 1; }
    report=''; while [[ $# -gt 0 ]]; do if [[ "$1" == --outputFile ]]; then report="$2"; break; fi; shift; done
    node --input-type=module -e 'console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M06_UPKEEP_APP_SKIPPED?1:0,testResults:[{name:"/repo/apps/web/server/m06-upkeep-sql.integration.test.ts",assertionResults:[{status:process.env.EMR_TEST_M06_UPKEEP_APP_SKIPPED?"pending":"passed"}]}]}));' > "$report"
    exit 0
  fi
  printf '%s\\n' "\${M02_TEST_DATABASE_URL:-}" > "$EMR_TEST_CAPTURE/m02.target"
  [[ "\${EMR_TEST_FAIL_PHASE:-}" != m02 ]] || { printf '${marker}\\n'; exit 1; }
  report=''
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == --outputFile ]]; then report="$2"; break; fi
    shift
  done
  [[ -n "$report" ]] || exit 1
  node --input-type=module -e 'const make=(name,count)=>({name:"/repo/scripts/seed/"+name,assertionResults:Array.from({length:count},()=>({status:process.env.EMR_TEST_M02_SKIPPED||(name==="owner-exclusions.integration.test.ts"&&process.env.EMR_TEST_M02_OWNER_SKIPPED)||(name==="prod-operations.integration.test.ts"&&process.env.EMR_TEST_M02_PROD_SKIPPED)?"pending":"passed"}))});const owner=process.env.EMR_TEST_M02_OWNER_MISSING?[]:[make("owner-exclusions.integration.test.ts",21)];const prod=process.env.EMR_TEST_M02_PROD_MISSING?[]:[make("prod-operations.integration.test.ts",6)];console.log(JSON.stringify({success:true,numFailedTests:0,numPendingTests:process.env.EMR_TEST_M02_SKIPPED?1:0,testResults:[make("seed-competitors.integration.test.ts",10),make("database.test.ts",5),...owner,...prod]}));' > "$report"
elif [[ "\${0##*/}" == psql ]]; then
  role="\${PGUSER%%.*}"
  printf '%s\\n' "$@" > "$EMR_TEST_CAPTURE/$role.args"
  printf '%s\\n' "$PGHOST" "$PGPORT" "$PGUSER" "$PGDATABASE" "$PGSSLMODE" > "$EMR_TEST_CAPTURE/$role.connection"
  cat > "$EMR_TEST_CAPTURE/$role.sql"
  [[ "$PGPASSWORD" == synthetic-pass ]] || exit 2
  printf '${marker}\\n'
  printf '${marker}\\n' >&2
  [[ "\${EMR_TEST_FAIL_ROLE:-}" != "$role" ]]
else
  if [[ "$1" == --version ]]; then printf '2.121.0\\n'; exit 0; fi
  printf '%s\\n' "$*" >> "$EMR_TEST_CAPTURE/commands"
  if [[ "$1 $2" == 'gen types' ]]; then
    [[ "\${EMR_TEST_FAIL_PHASE:-}" != types ]] || { printf '${marker}\\n'; exit 1; }
    if [[ "\${EMR_TEST_TYPES_MISMATCH:-}" == 1 ]]; then printf 'export type Database = {};\\n';
    else cat packages/shared/src/db.types.ts; fi
    exit 0
  fi
  printf '${marker}\\n'
  printf '${marker}\\n' >&2
  phase="$1"
  if [[ "$1 $2" == 'db reset' ]]; then phase=reset; [[ "$*" != *'--no-seed'* ]] || phase=foundation-reset; fi
  if [[ "$1 $2" == 'test db' ]]; then
    phase=test
    if [[ "$*" == *'supabase/tests/12_m03_launch_admission.test.sql'* ]]; then
      phase=foundation-test
      printf 'Files=%s, Tests=%s, 1 wallclock secs\\nResult: PASS\\n' "\${EMR_TEST_FOUNDATION_TAP_FILES:-3}" "\${EMR_TEST_FOUNDATION_TAP_COUNT:-173}"
    elif [[ "$*" == *'supabase/tests/11_worker_gateway.test.sql'* ]]; then
      phase=gw-test
      printf 'Files=%s, Tests=%s, 1 wallclock secs\\nResult: PASS\\n' "\${EMR_TEST_GW_TAP_FILES:-1}" "\${EMR_TEST_GW_TAP_COUNT:-102}"
    else
      printf 'Files=%s, Tests=%s, 1 wallclock secs\\nResult: PASS\\n' "\${EMR_TEST_TAP_FILES:-20}" "\${EMR_TEST_TAP_COUNT:-257}"
    fi
  fi
  if [[ "$1 $2" == 'db advisors' ]]; then
    case "$*" in *'--type security'*) phase=security;; *) phase=performance;; esac
  fi
  [[ "\${EMR_TEST_FAIL_PHASE:-}" != "$phase" ]]
fi
`;
  for (const name of ['psql', 'supabase', 'pnpm'])
    writeFileSync(join(directory, name), stub, { mode: 0o700 });
  writeFileSync(
    join(directory, 'node'),
    `#!/usr/bin/env bash
set -eu
if [[ "\${1:-}" == scripts/db/check-m03-foundation-concurrency.mjs ]]; then
  printf '%s\\n' "$*" >> "$EMR_TEST_CAPTURE/commands"
  [[ "\${EMR_TEST_FAIL_PHASE:-}" != foundation-concurrency ]] || { printf '${marker}\\n'; exit 1; }
  printf '%s\\n' '{"passed":true,"scope":"ci-owned-no-seed-local-fixture","actorConcurrency":"executed","checks":{"maxTwoReservations":true,"overlappingDuplicateSingleSideEffect":true,"committedResultRecoveredByReadback":true,"overlappingActorOnePostPermit":true,"unknownOriginalPreventsAnotherLaunch":true,"closedNeverReopens":true,"ownedFixtureRemovedAndBaselinePreserved":true,"databaseClientsClosed":true}}'
else exec ${quotedNode} "$@"; fi
`,
    { mode: 0o700 },
  );
  try {
    return run(directory);
  } finally {
    const owned = realpathSync(directory);
    assert.equal(dirname(owned), allowedRoot);
    assert.ok(owned.startsWith(`${allowedRoot}${sep}emr-pooler-test-`));
    assert.equal(readFileSync(join(owned, '.owner'), 'utf8'), 'emr-pooler-test');
    rmSync(owned, { recursive: true });
  }
}

function execute(directory, script, overrides = {}, trace = false) {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/^(N8N_WRITER_URL|API_AGENT_URL|EMR_POOLER_ENV|EMR_TEST_)/.test(key)) delete env[key];
  Object.assign(env, {
    N8N_WRITER_URL: writerUrl,
    API_AGENT_URL: readerUrl,
    EMR_FAKE_BIN: bashPath(directory),
    EMR_TEST_CAPTURE: bashPath(directory),
    EMR_TEST_SCRIPT: bashPath(resolve(repo, script)),
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    ...overrides,
  });
  const child = spawnSync(
    bash,
    ['-c', `export PATH="$EMR_FAKE_BIN:$PATH"; exec bash ${trace ? '-x ' : ''}"$EMR_TEST_SCRIPT"`],
    {
      cwd: repo,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  if (child.error) throw child.error;
  assert.ok(!`${child.stdout}${child.stderr}`.includes(marker), 'private tool output escaped');
  assert.ok(!`${child.stdout}${child.stderr}`.includes('synthetic-pass'), 'credential escaped');
  return child;
}

test('pooler checks pass credentials through libpq environment, verify roles and roll back test writes', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/check-pooler.sh', {}, true);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, 'n8n_writer: OK\napi_agent: OK\n');
    for (const [role, port] of [
      ['n8n_writer', '5432'],
      ['api_agent', '6543'],
    ]) {
      const args = readFileSync(join(directory, `${role}.args`), 'utf8');
      assert.ok(!args.includes('postgresql://') && !args.includes('synthetic-pass'));
      assert.match(args, /ON_ERROR_STOP=1/);
      assert.match(
        readFileSync(join(directory, `${role}.connection`), 'utf8'),
        new RegExp(`${port}\\n${role}\\.testref\\npostgres\\nrequire`),
      );
      const sql = readFileSync(join(directory, `${role}.sql`), 'utf8');
      assert.match(sql, new RegExp(`current_user = '${role}'`));
      assert.match(sql, /rollback;/i);
    }
    const sql = readFileSync(join(directory, 'n8n_writer.sql'), 'utf8');
    assert.match(sql, /ops\.start_run/);
    assert.match(sql, /ops\.finish_run/);
    assert.match(readFileSync(join(directory, 'api_agent.sql'), 'utf8'), /api\.competitors_v/);
  }));

test('pooler checks fail safely when configuration is missing', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/check-pooler.sh', { N8N_WRITER_URL: '', API_AGENT_URL: '' });
    assert.equal(child.status, 1);
    assert.equal(child.stdout, 'n8n_writer: FAIL\napi_agent: FAIL\n');
    assert.equal(existsSync(join(directory, 'n8n_writer.args')), false);
  }));

test('pooler checks reject wrong role, port, TLS and connection-override URLs before connecting', () =>
  fixture((directory) => {
    for (const invalid of [
      writerUrl.replace(':5432/', ':6543/'),
      writerUrl.replace('n8n_writer.', 'postgres.'),
      writerUrl.replace('sslmode=require', 'sslmode=disable'),
      `${writerUrl}&sslmode=disable`,
      `${writerUrl}&host=localhost`,
    ]) {
      const child = execute(directory, 'scripts/db/check-pooler.sh', { N8N_WRITER_URL: invalid });
      assert.equal(child.status, 1);
      assert.equal(child.stdout, 'n8n_writer: FAIL\napi_agent: OK\n');
      assert.equal(existsSync(join(directory, 'n8n_writer.args')), false);
    }
  }));

test('one pooler failure does not suppress the other role result', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/check-pooler.sh', { EMR_TEST_FAIL_ROLE: 'n8n_writer' });
    assert.equal(child.status, 1);
    assert.equal(child.stdout, 'n8n_writer: FAIL\napi_agent: OK\n');
  }));

test('CI runner uses only explicit local targets and exposes only safe summaries', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh');
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /pgTAP: 20 files, 257 assertions, PASS/);
    const commands = readFileSync(join(directory, 'commands'), 'utf8');
    assert.match(
      commands,
      /start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor/,
    );
    assert.match(commands, /db reset --local/);
    assert.match(commands, /test db --local/);
    assert.match(commands, /supabase\/tests\/15_m04_vimeo_resolution\.test\.sql/);
    assert.match(commands, /supabase\/tests\/16_m04_collectors\.test\.sql/);
    assert.match(commands, /supabase\/tests\/17_m04_recent_monitoring\.test\.sql/);
    assert.match(commands, /supabase\/tests\/18_m05_collectors\.test\.sql/);
    assert.match(commands, /supabase\/tests\/20_m06_media\.test\.sql/);
    assert.match(commands, /supabase\/tests\/21_m06_cadence_health\.test\.sql/);
    assert.match(commands, /supabase\/tests\/22_m06_stories\.test\.sql/);
    assert.match(commands, /supabase\/tests\/23_m06_campaign\.test\.sql/);
    assert.match(commands, /m05-sql.integration.test.ts/);
    assert.match(commands, /m06-media-sql.integration.test.ts/);
    assert.match(commands, /m06-stories-sql.integration.test.ts/);
    assert.match(commands, /gen types typescript --local --schema app,ops,ingest,api --output-format text/);
    assert.match(child.stdout, /M05 SQL\/app contract: PASS/);
    assert.match(child.stdout, /M06 SQL\/app contract: PASS/);
    assert.match(child.stdout, /Generated database types: PASS/);
    assert.match(commands, /db advisors --local --type security --level warn --fail-on warn/);
    assert.match(commands, /db advisors --local --type performance --level warn --fail-on error/);
    assert.match(
      commands,
      /--filter @emr\/scripts exec vitest run seed\/seed-competitors.integration.test.ts seed\/database.test.ts seed\/owner-exclusions.integration.test.ts seed\/prod-operations.integration.test.ts --no-file-parallelism --reporter=json/,
    );
    assert.equal(
      readFileSync(join(directory, 'm02.target'), 'utf8').trim(),
      'postgresql://postgres@127.0.0.1:60322/postgres',
    );
    assert.match(child.stdout, /M02 PostgreSQL acceptance: 42 assertions, PASS/);
    assert.ok(!commands.includes('--linked'));
    const explicitTargets = commands.split('\n').filter((line) => line.includes('--db-url'));
    assert.equal(explicitTargets.length, 2);
    assert.match(
      explicitTargets.find((line) => line.includes('11_worker_gateway.test.sql')),
      /test db --db-url postgresql:\/\/supabase_admin@127\.0\.0\.1:60322\/postgres supabase\/tests\/11_worker_gateway\.test\.sql/,
    );
    assert.match(child.stdout, /GW-01 pgTAP: 1 files, 102 assertions, PASS/);
    assert.match(
      explicitTargets.find((line) => line.includes('12_m03_launch_admission.test.sql')),
      /12_m03_launch_admission\.test\.sql.*13_m03_foundation_gateway\.test\.sql.*14_m03_foundation_boundaries\.test\.sql/,
    );
    assert.match(child.stdout, /Foundation concurrent SQL: PASS/);
    assert.match(child.stdout, /Foundation pgTAP: 3 files, 173 assertions, PASS/);
    assert.match(child.stdout, /Foundation SQL\/app contract: PASS/);
    const lines = commands.trim().split('\n');
    const emptyReset = lines.indexOf('db reset --local --no-seed');
    const foundation = lines.findIndex((line) => line.includes('12_m03_launch_admission.test.sql'));
    const seededReset = lines.indexOf('db reset --local');
    assert.ok(emptyReset >= 0 && foundation > emptyReset && seededReset > foundation);
  }));

test('CI runner refuses non-GitHub environments without starting any service', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { GITHUB_ACTIONS: '' });
    assert.equal(child.status, 1);
    assert.equal(existsSync(join(directory, 'commands')), false);
  }));

test('CI runner fails closed at each failed phase without leaking captured output', () =>
  fixture((directory) => {
    for (const [index, phase] of [
      'start',
      'foundation-reset',
      'foundation-concurrency',
      'foundation-test',
      'reset',
      'test',
      'gw-test',
      'foundation-app',
      'm04-app',
      'm05-app',
      'm06-app',
      'm06-stories-app',
      'm06-upkeep-app',
      'types',
      'security',
      'performance',
      'm02',
    ].entries()) {
      writeFileSync(join(directory, 'commands'), '');
      const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_FAIL_PHASE: phase });
      assert.equal(child.status, 1);
      assert.equal(readFileSync(join(directory, 'commands'), 'utf8').trim().split('\n').length, index + 1);
    }
  }));

test('CI runner rejects zero assertions or an incomplete SQL suite set', () =>
  fixture((directory) => {
    for (const overrides of [
      { EMR_TEST_TAP_COUNT: '0' },
      { EMR_TEST_TAP_FILES: '12' },
      { EMR_TEST_TAP_FILES: '13' },
      { EMR_TEST_TAP_FILES: '14' },
      { EMR_TEST_TAP_FILES: '15' },
      { EMR_TEST_TAP_FILES: '16' },
      { EMR_TEST_TAP_FILES: '17' },
    ]) {
      assert.equal(execute(directory, 'scripts/db/run-local-ci.sh', overrides).status, 1);
    }
  }));

test('CI runner rejects skipped M04 connected SQL assertions', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M04_APP_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /M04 SQL\/app contract: FAIL/);
  }));

test('CI runner rejects skipped M05 SQL and a generated-type mismatch', () =>
  fixture((directory) => {
    const skipped = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M05_APP_SKIPPED: '1' });
    assert.equal(skipped.status, 1);
    assert.match(skipped.stderr, /M05 SQL\/app contract: FAIL/);
    const mismatch = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_TYPES_MISMATCH: '1' });
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /Generated database types: FAIL/);
    for (const child of [skipped, mismatch])
      assert.ok(!child.stdout.includes(marker) && !child.stderr.includes(marker));
  }));

test('CI runner rejects skipped M06 connected SQL assertions', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M06_APP_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /M06 SQL\/app contract: FAIL/);
    assert.ok(!child.stdout.includes(marker) && !child.stderr.includes(marker));
  }));

test('CI runner rejects skipped M06 stories SQL assertions', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M06_STORIES_APP_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /M06 stories SQL\/app contract: FAIL/);
    assert.ok(!child.stdout.includes(marker) && !child.stderr.includes(marker));
  }));

test('CI runner rejects skipped M06 upkeep SQL assertions', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M06_UPKEEP_APP_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /M06 upkeep SQL\/app contract: FAIL/);
    assert.ok(!child.stdout.includes(marker) && !child.stderr.includes(marker));
  }));

test('CI runner rejects skipped M02 PostgreSQL assertions', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M02_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /missing, skipped or failed assertions/);
    assert.ok(!child.stdout.includes(marker) && !child.stderr.includes(marker));
  }));

test('CI runner rejects a missing owner-exclusion SQL suite', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M02_OWNER_MISSING: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /missing, skipped or failed assertions/);
  }));

test('CI runner rejects a skipped owner-exclusion SQL suite while other suites pass', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M02_OWNER_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /missing, skipped or failed assertions/);
  }));

test('CI runner rejects a missing production-component rollback suite', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M02_PROD_MISSING: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /missing, skipped or failed assertions/);
  }));

test('CI runner rejects skipped production-component assertions despite a success summary', () =>
  fixture((directory) => {
    const child = execute(directory, 'scripts/db/run-local-ci.sh', { EMR_TEST_M02_PROD_SKIPPED: '1' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /missing, skipped or failed assertions/);
  }));

test('CI rejects omitted or incomplete mandatory gateway session-principal assertions', () =>
  fixture((directory) => {
    for (const overrides of [
      { EMR_TEST_GW_TAP_COUNT: '0' },
      { EMR_TEST_GW_TAP_COUNT: '101' },
      { EMR_TEST_GW_TAP_FILES: '0' },
    ]) {
      const child = execute(directory, 'scripts/db/run-local-ci.sh', overrides);
      assert.equal(child.status, 1);
      assert.match(child.stderr, /GW-01 pgTAP: FAIL/);
    }
  }));

test('CI rejects incomplete foundation TAP or skipped actual SQL/application checks', () =>
  fixture((directory) => {
    for (const overrides of [
      { EMR_TEST_FOUNDATION_TAP_FILES: '2' },
      { EMR_TEST_FOUNDATION_TAP_COUNT: '172' },
      { EMR_TEST_FOUNDATION_APP_SKIPPED: '1' },
    ]) {
      const child = execute(directory, 'scripts/db/run-local-ci.sh', overrides);
      assert.equal(child.status, 1);
      assert.match(child.stderr, /Foundation (pgTAP|SQL\/app contract): FAIL/);
    }
  }));
