import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postgres from 'postgres';

// CI's already-owned local stack only. This checker never resets/seeds a DB,
// changes C999/Test House, or reads an application/provider credential.
// PostgreSQL17: https://www.postgresql.org/docs/17/explicit-locking.html
const root = fileURLToPath(new URL('../../', import.meta.url));
const container = 'supabase_db_everyone-market-radar';
class CheckFailure extends Error {}
function requireCondition(condition, stage) {
  if (!condition) throw new CheckFailure(stage);
}

export function assertCiAdmission(env, config) {
  requireCondition(env.CI === 'true' && env.GITHUB_ACTIONS === 'true', 'ci-admission');
  requireCondition(
    !env.DOCKER_HOST || /^(unix:\/\/\/|npipe:\/\/)/.test(env.DOCKER_HOST),
    'docker-host-local',
  );
  requireCondition(/^project_id\s*=\s*"everyone-market-radar"\s*$/m.test(config), 'config-project');
  const section = config.split(/^\[db\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
  requireCondition(/^port\s*=\s*60322\s*$/m.test(section), 'config-port');
}

export function assertDockerIdentity(context, inspected, previousId) {
  requireCondition(
    /^(unix:\/\/\/|npipe:\/\/)/.test(context[0]?.Endpoints?.docker?.Host ?? ''),
    'docker-context-local',
  );
  requireCondition(
    inspected?.Config?.Labels?.['com.supabase.cli.project'] === 'everyone-market-radar' &&
      inspected?.State?.Running === true &&
      typeof inspected.Id === 'string' &&
      inspected.Id.length > 0 &&
      inspected?.NetworkSettings?.Ports?.['5432/tcp']?.some((p) => p.HostPort === '60322'),
    'container-identity',
  );
  requireCondition(!previousId || inspected.Id === previousId, 'container-replaced');
  return inspected.Id;
}

export function dockerChildEnvironment(env) {
  const names = [
    'PATH',
    'Path',
    'SystemRoot',
    'SYSTEMROOT',
    'SystemDrive',
    'WINDIR',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'TMP',
    'DOCKER_CONTEXT',
    'DOCKER_HOST',
  ];
  return Object.fromEntries(names.filter((k) => typeof env[k] === 'string').map((k) => [k, env[k]]));
}

export function fixedConnectionOptions(application) {
  return {
    host: '127.0.0.1',
    port: 60322,
    database: 'postgres',
    username: 'postgres',
    password: 'postgres',
    ssl: false,
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 0,
    onnotice: () => {},
    connection: {
      application_name: application,
      statement_timeout: '8000',
      lock_timeout: '6000',
    },
  };
}

export function assertCostRace(receipts, expectedInserts, actualRows, barrierObserved) {
  requireCondition(
    Array.isArray(receipts) &&
      receipts.length === 2 &&
      receipts.every((n) => Number.isInteger(n) && (n === 0 || n === expectedInserts)) &&
      receipts.reduce((a, b) => a + b, 0) === expectedInserts &&
      actualRows === expectedInserts &&
      barrierObserved === true,
    'cost-race-result',
  );
}

function docker(args, env) {
  const r = spawnSync('docker', args, {
    cwd: root,
    env: dockerChildEnvironment(env),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  requireCondition(!r.error && r.status === 0, 'docker-readback');
  return r.stdout.trim();
}

function verifyDocker(env, previousId) {
  let context, inspected;
  try {
    context = JSON.parse(docker(['context', 'inspect'], env));
    // Refuse a remote context before contacting/inspecting its daemon.
    requireCondition(
      /^(unix:\/\/\/|npipe:\/\/)/.test(context[0]?.Endpoints?.docker?.Host ?? ''),
      'docker-context-local',
    );
    inspected = JSON.parse(docker(['inspect', container], env))[0];
  } catch (error) {
    if (error instanceof CheckFailure) throw error;
    throw new CheckFailure('docker-readback');
  }
  const id = assertDockerIdentity(context, inspected, previousId);
  const systemId = docker(
    [
      'exec',
      container,
      'psql',
      '-X',
      '-Atq',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'select system_identifier from pg_control_system();',
    ],
    env,
  );
  requireCondition(/^\d+$/.test(systemId), 'container-cluster-identity');
  return { id, systemId };
}

async function databaseIdentity(sql, systemId) {
  const [row] = await sql`select current_database() as database, current_user as role,
    current_setting('server_version_num')::int/10000 as major,
    (select system_identifier::text from pg_control_system()) as system_id,
    to_regprocedure('ops.log_cost(jsonb)') is not null as has_rpc`;
  requireCondition(
    row.database === 'postgres' &&
      row.role === 'postgres' &&
      row.major === 17 &&
      row.system_id === systemId &&
      row.has_rpc === true,
    'database-identity',
  );
}

async function baseline(sql) {
  const [row] = await sql`select md5(jsonb_build_object(
    'competitors',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from app.competitors c),
    'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from app.competitor_accounts a),
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from app.items i),
    'raw',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from ingest.raw_items r),
    'run_count',(select count(*) from ops.scrape_runs),
    'cost_count',(select count(*) from ops.cost_ledger))::text) as digest`;
  return row.digest;
}

async function blockedBy(observer, waiter, blocker, applications) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const [row] = await observer`select count(*)::int as n from pg_stat_activity w
      join pg_stat_activity b on b.pid=${blocker}
      where w.pid=${waiter} and w.datname='postgres' and w.usename='postgres'
        and w.application_name=any(${applications}) and b.application_name=any(${applications})
        and w.wait_event_type='Lock' and b.pid=any(pg_blocking_pids(w.pid))`;
    if (row.n === 1) return true;
    await delay(25);
  }
  throw new CheckFailure('lock-barrier-not-observed');
}

async function cost(tx, entries) {
  const [row] = await tx`select ops.log_cost(${tx.json(entries)}::jsonb) as inserted`;
  return row.inserted;
}

async function costTransaction(sql, entries) {
  // Owner-context synthetic lock proof; pgTAP separately verifies worker ACLs.
  // Do not persist a SET ROLE membership merely to run this local checker.
  return sql.begin((tx) => cost(tx, entries));
}

export async function runM03Concurrency(env = process.env) {
  const checks = {};
  const clients = [];
  let owner, target, initialBaseline, ledgerDay;
  let fixtureAttempted = false;
  let cleanup = 'not-needed';
  let failure;
  const marker = randomUUID();
  const keys = ['single', 'a', 'b'].map((k) => `m03-concurrency:${marker}:${k}`);
  const applications = ['observer', 'first', 'second', 'gate'].map((n) => `emr-m03-${marker}-${n}`);
  const entry = (key) => ({
    provider: 'other',
    category: 'm03-concurrency',
    quantity: 1,
    unit: 'result',
    cost_usd: 0.01,
    day: ledgerDay,
    platform: 'news',
    meta: { cost_key: key, fixture: marker },
  });
  try {
    assertCiAdmission(env, readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8'));
    target = verifyDocker(env);
    for (const application of applications) clients.push(postgres(fixedConnectionOptions(application)));
    const [observer, first, second, gate] = clients;
    owner = observer;
    await databaseIdentity(owner, target.systemId);
    initialBaseline = await baseline(owner);
    const pids = await Promise.all(
      clients.map(async (client) => (await client`select pg_backend_pid() as pid`)[0].pid),
    );
    const [day] = await owner`select (now() at time zone 'Africa/Cairo')::date::text as day`;
    ledgerDay = day.day;
    const [preexisting] = await owner`select count(*)::int as n from ops.cost_ledger
      where meta->>'fixture'=${marker} or meta->>'cost_key'=any(${keys})`;
    requireCondition(preexisting.n === 0, 'fixture-key-collision');
    fixtureAttempted = true;

    await first.unsafe('begin');
    const firstReceipt = await cost(first, [entry(keys[0])]);
    const pendingSingle = costTransaction(second, [entry(keys[0])]);
    pendingSingle.catch(() => {});
    const singleBarrier = await blockedBy(owner, pids[2], pids[1], applications);
    await first.unsafe('commit');
    const secondReceipt = await pendingSingle;
    const [single] = await owner`select count(*)::int as n, sum(cost_usd)::text as usd
      from ops.cost_ledger where meta->>'cost_key'=${keys[0]}`;
    assertCostRace([firstReceipt, secondReceipt], 1, single.n, singleBarrier);
    requireCondition(Number(single.usd) === 0.01, 'single-cost-total');
    checks.equalSingleKey = {
      passed: true,
      barrierObserved: true,
      receipts: [firstReceipt, secondReceipt],
      rows: single.n,
    };

    // Hold the lexically first key before both batches start. A correctly sorted
    // reversed batch must block here WITHOUT acquiring the later key. The old
    // unsorted lock order would take b while waiting for a, permitting deadlock.
    await gate.unsafe('begin');
    await gate`select pg_advisory_xact_lock(hashtextextended(${'emr-cost:other:' + keys[1]},0))`;
    const pendingForward = costTransaction(first, [entry(keys[1]), entry(keys[2])]);
    const pendingReverse = costTransaction(second, [entry(keys[2]), entry(keys[1])]);
    pendingForward.catch(() => {});
    pendingReverse.catch(() => {});
    const forwardBarrier = await blockedBy(owner, pids[1], pids[3], applications);
    const reverseBarrier = await blockedBy(owner, pids[2], pids[3], applications);
    const [locks] = await owner`select count(*)::int as n from pg_locks
      where pid=any(${[pids[1], pids[2]]}) and locktype='advisory' and granted`;
    requireCondition(locks.n === 0, 'reversed-batch-took-later-key');
    await gate.unsafe('commit');
    const receipts = await Promise.all([pendingForward, pendingReverse]);
    const [batch] = await owner`select count(*)::int as n, sum(cost_usd)::text as usd
      from ops.cost_ledger where meta->>'cost_key'=any(${keys.slice(1)})`;
    assertCostRace(receipts, 2, batch.n, forwardBarrier && reverseBarrier);
    requireCondition(Number(batch.usd) === 0.02, 'batch-cost-total');
    checks.reversedEqualBatch = {
      passed: true,
      barriersObserved: 2,
      laterKeysHeldBeforeFirstKey: 0,
      receipts,
      rows: batch.n,
    };
  } catch (error) {
    failure = error instanceof CheckFailure ? error.message : 'execution';
  } finally {
    if (fixtureAttempted && owner && target) {
      try {
        const verified = verifyDocker(env, target.id);
        requireCondition(verified.systemId === target.systemId, 'cluster-replaced');
        await databaseIdentity(owner, target.systemId);
        await owner`select pg_terminate_backend(pid) from pg_stat_activity
          where datname='postgres' and usename='postgres' and application_name=any(${applications.slice(1)})
            and pid<>pg_backend_pid()`;
        await owner.begin(async (tx) => {
          await tx`select id from ops.cost_ledger
            where meta->>'fixture'=${marker} or meta->>'cost_key'=any(${keys}) for update`;
          const [unowned] = await tx`select count(*)::int as n from ops.cost_ledger
            where (meta->>'fixture'=${marker} or meta->>'cost_key'=any(${keys})) and
              (provider<>'other' or category<>'m03-concurrency' or quantity<>1 or unit<>'result' or cost_usd<>0.01
                or day<>${ledgerDay}::date or run_id is not null or competitor_id is not null
                or item_id is not null or platform is distinct from 'news'::app.platform
                or not(meta->>'cost_key'=any(${keys}))
                or meta is distinct from jsonb_build_object('cost_key',meta->>'cost_key','fixture',${marker}::text))`;
          requireCondition(Number(unowned.n) === 0, 'cleanup-unowned-attribution');
          await tx`delete from ops.cost_ledger
            where meta->>'fixture'=${marker} and meta->>'cost_key'=any(${keys})`;
        });
        const [remaining] = await owner`select count(*)::int as n from ops.cost_ledger
          where meta->>'fixture'=${marker} or meta->>'cost_key'=any(${keys})`;
        requireCondition(Number(remaining.n) === 0, 'cleanup-remaining');
        requireCondition((await baseline(owner)) === initialBaseline, 'retained-baseline-changed');
        cleanup = 'OK';
      } catch {
        cleanup = 'FAIL';
        failure ??= 'fixture-cleanup';
      }
    }
    const closed = await Promise.allSettled(clients.map((client) => client.end({ timeout: 2 })));
    if (closed.some((r) => r.status !== 'fulfilled')) failure ??= 'owned-client-shutdown';
  }
  const checksCompleted = Object.keys(checks).length;
  if (!failure && checksCompleted !== 2) failure = 'missing-required-check';
  return {
    check: 'm03-cost-concurrency',
    observedAt: new Date().toISOString(),
    scope: 'ci-owned-local-synthetic-costs',
    passed: !failure,
    skipped: false,
    checksCompleted,
    checks,
    cleanup,
    retainedCatalogAndTestHouseUnchanged: cleanup === 'OK',
    atomicCallbackRace: 'not-covered: requires independent disposable C999/emr-smoke-test database',
    ...(failure ? { failure } : {}),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result =
    process.argv.length === 2
      ? await runM03Concurrency()
      : {
          check: 'm03-cost-concurrency',
          passed: false,
          skipped: false,
          checksCompleted: 0,
          failure: 'unexpected-arguments',
        };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
}
