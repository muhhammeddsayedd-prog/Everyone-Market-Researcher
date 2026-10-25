import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';

// LOCAL fixture only. Public Supabase default fixture password, never a hosted
// password, token, role handoff or gateway runtime secret. No Docker reset/seed.
const root = fileURLToPath(new URL('../../', import.meta.url));
const self = fileURLToPath(import.meta.url);
const windowId = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
class GatewayCheckFailure extends Error {}
function requireCondition(condition, code) {
  if (!condition) throw new GatewayCheckFailure(code);
}
export function assertFixtureAdmission(args, config) {
  requireCondition(args.length === 1 && args[0] === '--local', 'gw01_local_admission');
  requireCondition(/^project_id\s*=\s*"everyone-market-radar"\s*$/m.test(config), 'gw01_local_config');
  const db = config.split(/^\[db\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
  requireCondition(/^port\s*=\s*60322\s*$/m.test(db), 'gw01_local_config');
}
export function fixedGatewayConnectionOptions(application) {
  return {
    host: '127.0.0.1',
    port: 60322,
    database: 'postgres',
    username: 'supabase_admin',
    password: 'postgres',
    ssl: false,
    max: 1,
    prepare: false,
    connect_timeout: 3,
    idle_timeout: 0,
    onnotice: () => {},
    connection: {
      application_name: application,
      statement_timeout: '8000',
      lock_timeout: '2000',
      idle_in_transaction_session_timeout: '10000',
    },
  };
}
export function gatewayWorkerEnvironment(env) {
  const names = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'];
  return Object.fromEntries(
    names.filter((name) => typeof env[name] === 'string').map((name) => [name, env[name]]),
  );
}
export function assertPristineGateway(row) {
  requireCondition(
    row?.window_id === windowId &&
      row.namespace === 'gw01-dev' &&
      row.project_ref === 'zmotjsbzhzjvpelxvxlf' &&
      row.environment === 'dev' &&
      row.bound_audience === null &&
      row.bound_commit_sha === null &&
      row.bound_deployment_id === null &&
      row.starts_at === null &&
      row.expires_at === null &&
      row.closed_at === null &&
      row.admitted_count === 0 &&
      row.close_count === 0 &&
      row.minute_start === null &&
      row.minute_count === 0 &&
      row.day_start === null &&
      row.day_count === 0 &&
      row.requests === 0 &&
      row.holders === 0,
    'gw01_fixture_not_pristine',
  );
}
export function assertRace(states, expected, count, expectedCount) {
  requireCondition(
    Array.isArray(states) &&
      states.length === Object.values(expected).reduce((a, b) => a + b, 0) &&
      Object.entries(expected).every(([state, n]) => states.filter((x) => x === state).length === n) &&
      count === expectedCount,
    'gw01_race_mismatch',
  );
}
function requestId(n) {
  return `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
const statusArgs = { targetRequestId: requestId(999) };
export function createAuditArgsFactory() {
  const ids = new Map();
  return (n) => {
    if (!ids.has(n)) ids.set(n, randomUUID());
    return {
      workflow: 'M03-GATEWAY-ACCEPTANCE-DEV',
      kind: 'notify',
      message: 'gateway_acceptance',
      executionId: ids.get(n),
    };
  };
}
export async function finalizeGatewayResources(cleanup, clients) {
  try {
    await cleanup();
  } finally {
    const settled = await Promise.allSettled(
      clients.map((client) => Promise.resolve().then(() => client.end({ timeout: 2 }))),
    );
    requireCondition(
      settled.every((x) => x.status === 'fulfilled'),
      'gw01_client_close_failed',
    );
  }
}
async function writer(sql, callback) {
  return sql.begin(async (tx) => {
    await tx.unsafe('set local session authorization n8n_writer');
    return callback(tx);
  });
}
async function admit(sql, id, operation = 'identity.read', args = {}) {
  return writer(sql, async (tx) => {
    const [row] =
      await tx`select ops.worker_gateway_admit(${windowId}::uuid,${requestId(id)}::uuid,${operation},${tx.json(args)}::jsonb,'admit') as r`;
    return row.r;
  });
}
async function control(sql, mode) {
  return writer(sql, async (tx) => {
    const args =
      mode === 'bind'
        ? {
            audience: 'https://everyone-market-researcher-gw01-fixture.vercel.app',
            commitSha: '0000000000000000000000000000000000000000',
            deploymentId: 'dpl_GW01LocalFixture',
          }
        : {};
    const [row] =
      await tx`select ops.worker_gateway_admit(${windowId}::uuid,${requestId(998)}::uuid,'identity.read',${tx.json(args)}::jsonb,${mode}) as r`;
    return row.r;
  });
}
async function execute(tx, id, operation = 'identity.read', args = {}) {
  const [row] =
    await tx`select ops.worker_gateway_execute(${windowId}::uuid,${requestId(id)}::uuid,${operation},${tx.json(args)}::jsonb) as r`;
  return row.r;
}
async function status(sql, id) {
  return writer(sql, async (tx) => {
    const [row] = await tx`select ops.worker_gateway_status(${windowId}::uuid,${requestId(id)}::uuid) as r`;
    return row.r;
  });
}
async function readFixture(sql) {
  const [row] = await sql`select w.*,
    (select count(*)::int from ops.worker_gateway_requests) as requests,
    (select count(*)::int from ops.worker_gateway_leases where request_id is not null) as holders
    from ops.worker_gateway_rate_windows w where w.window_id=${windowId}::uuid`;
  return row;
}
async function clearOwnedFixture(sql) {
  // Invoked ONLY after exact local/pristine admission and exclusive fixture lock.
  // It does not touch original tables, audit records, migrations or any hosted DB.
  await sql.begin(async (tx) => {
    await tx`update ops.worker_gateway_leases set request_id=null,expires_at=null where window_id=${windowId}::uuid`;
    await tx`delete from ops.worker_gateway_requests where window_id=${windowId}::uuid`;
    await tx`update ops.worker_gateway_rate_windows set starts_at=null,expires_at=null,closed_at=null,
      admitted_count=0,close_count=0,minute_start=null,minute_count=0,day_start=null,day_count=0,
      bound_audience=null,bound_commit_sha=null,bound_deployment_id=null
      where window_id=${windowId}::uuid`;
  });
}
async function baseline(sql) {
  const [row] = await sql`select md5(jsonb_build_object(
    'history',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m),
    'competitors',(select jsonb_agg(to_jsonb(c) order by id) from app.competitors c),
    'accounts',(select jsonb_agg(to_jsonb(a) order by id) from app.competitor_accounts a),
    'items',(select jsonb_agg(to_jsonb(i) order by id) from app.items i),
    'raw',(select jsonb_agg(to_jsonb(r) order by id) from ingest.raw_items r),
    'runs',(select jsonb_agg(to_jsonb(s) order by id) from ops.scrape_runs s),
    'costs',(select jsonb_agg(to_jsonb(c) order by id) from ops.cost_ledger c))::text) as digest,
    (select count(*)::int from ops.audit_log) as audits`;
  return row;
}
function spawnWorker(payload) {
  const child = fork(self, ['--worker'], {
    cwd: root,
    env: gatewayWorkerEnvironment(process.env),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout.resume();
  child.stderr.resume();
  child.once('error', () => {}); // Suppress raw native process errors.
  const messages = [];
  let closed = false;
  const close = new Promise((resolve) =>
    child.once('close', (code, signal) => {
      closed = true;
      resolve({ code, signal });
    }),
  );
  child.on('message', (message) => messages.push(message));
  const hardTimer = setTimeout(() => child.kill('SIGKILL'), 15000);
  child.once('close', () => clearTimeout(hardTimer));
  async function wait(phase, timeout = 7000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const message = messages.find((x) => x?.phase === phase);
      if (message) return message;
      requireCondition(!closed, 'gw01_worker_closed_early');
      await delay(10);
    }
    throw new Error('gw01_worker_deadline');
  }
  return {
    async start() {
      await wait('ready');
      child.send(payload);
      return this;
    },
    wait,
    release() {
      child.send({ release: true });
    },
    async done() {
      const message = await wait('done');
      const result = await close;
      requireCondition(result.code === 0 && !result.signal, 'gw01_worker_failed');
      return message;
    },
    async kill() {
      if (!closed) child.kill('SIGKILL');
      await close;
    },
    close,
  };
}
async function workerMain() {
  let sql;
  const first = new Promise((resolve) => process.once('message', resolve));
  process.send({ phase: 'ready' });
  try {
    const p = await first;
    requireCondition(
      ['admit', 'execute', 'hold', 'lost', 'close'].includes(p?.action) &&
        Number.isInteger(p.id) &&
        p.id > 0 &&
        p.id <= 999,
      'gw01_worker_input',
    );
    requireCondition(
      ['identity.read', 'settings.read', 'request.status', 'error.log'].includes(p.operation) &&
        typeof p.args === 'object' &&
        p.args !== null,
      'gw01_worker_input',
    );
    sql = postgres(fixedGatewayConnectionOptions(`gw01-local-worker-${process.pid}`));
    const [identity] =
      await sql`select current_database() as database,current_user as principal,current_setting('server_version_num')::int/10000 as major,pg_backend_pid() as backend_pid`;
    requireCondition(
      identity.database === 'postgres' && identity.principal === 'supabase_admin' && identity.major === 17,
      'gw01_worker_target',
    );
    let result;
    process.send({ phase: 'querying', backendPid: identity.backend_pid });
    if (p.action === 'close') result = await control(sql, 'close');
    else if (p.action === 'admit') result = await admit(sql, p.id, p.operation, p.args);
    else
      result = await writer(sql, async (tx) => {
        const r = await execute(tx, p.id, p.operation, p.args);
        if (p.action === 'hold') {
          process.send({ phase: 'executed', state: r.state });
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('gw01_release_deadline')), 7000);
            process.once('message', (message) => {
              clearTimeout(timer);
              if (message?.release === true) resolve();
              else reject(new Error('gw01_release_invalid'));
            });
          });
        }
        return r;
      });
    await sql.end({ timeout: 2 });
    sql = null;
    // The lost-response fixture intentionally discards the database receipt.
    process.send(
      p.action === 'lost'
        ? { phase: 'done', receiptDiscarded: true }
        : { phase: 'done', state: result.state, code: result.code, total: result.window.totalAdmitted },
    );
    process.disconnect();
  } catch {
    if (sql) await sql.end({ timeout: 1 }).catch(() => {});
    if (process.connected) {
      process.send({ phase: 'failed', code: 'gw01_worker_failed' });
      process.disconnect();
    }
    process.exitCode = 1;
  }
}
export async function runGatewayConcurrency(args = process.argv.slice(2)) {
  assertFixtureAdmission(args, readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8'));
  const owner = postgres(fixedGatewayConnectionOptions(`gw01-local-owner-${process.pid}`));
  const barrier = postgres(fixedGatewayConnectionOptions(`gw01-local-barrier-${process.pid}`));
  const children = [];
  const checks = {};
  const auditArgs = createAuditArgsFactory();
  let fixtureOwned = false;
  let original;
  let releaseBarrier = () => {};
  let stage = 'local_preflight';
  try {
    const [identity] = await owner`select current_user as principal,current_database() as database,
      current_setting('server_version_num')::int/10000 as major,inet_server_port() as port,
      pg_try_advisory_lock(817403,99) as fixture_lock`;
    requireCondition(
      identity.principal === 'supabase_admin' &&
        identity.database === 'postgres' &&
        identity.major === 17 &&
        identity.port === 5432 &&
        identity.fixture_lock === true,
      'gw01_local_target',
    );
    assertPristineGateway(await readFixture(owner));
    original = await baseline(owner);
    fixtureOwned = true;
    async function parallel(payloads) {
      const jobs = payloads.map((payload) => {
        const w = spawnWorker(payload);
        children.push(w);
        return w;
      });
      await Promise.all(jobs.map((w) => w.start()));
      return Promise.all(jobs.map((w) => w.done()));
    }
    async function reset() {
      await clearOwnedFixture(owner);
      requireCondition((await control(owner, 'bind')).state === 'admitted', 'gw01_fixture_bind');
    }
    async function waitForLock(pid) {
      for (let i = 0; i < 100; i++) {
        const [row] = await owner`select count(*)::int as n from pg_stat_activity where pid=${pid}
          and application_name like 'gw01-local-worker-%' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0`;
        if (row.n === 1) return;
        await delay(10);
      }
      throw new Error('gw01_parent_lock_barrier');
    }
    stage = 'readonly_inspect';
    await owner.begin('read only', async (tx) => {
      await tx.unsafe('set local session authorization n8n_writer');
      const [r] =
        await tx`select ops.worker_gateway_admit(${windowId}::uuid,${requestId(998)}::uuid,'identity.read','{}'::jsonb,'inspect') as r`;
      requireCondition(
        r.r.window.startsAt === null && r.r.window.totalAdmitted === 0,
        'gw01_readonly_inspect',
      );
    });
    checks.inspectReadOnlyNoClock = true;
    stage = 'fixture_bind';
    await control(owner, 'bind');
    const four = (operation, argsFactory = () => ({})) =>
      [1, 2, 3, 4].map((id) => ({ action: 'admit', id, operation, args: argsFactory(id) }));
    // Distinct OS processes share actual committed counters, not an in-memory limiter.
    stage = 'hundred_cap';
    await owner`update ops.worker_gateway_rate_windows set admitted_count=98 where window_id=${windowId}::uuid`;
    const cap = await parallel(four('request.status', () => statusArgs));
    assertRace(
      cap.map((x) => x.state),
      { admitted: 2, limited: 2 },
      (await readFixture(owner)).admitted_count,
      100,
    );
    requireCondition(cap.filter((x) => x.code === 'request_limit').length === 2, 'gw01_hundred_cap');
    checks.hundredCapAcrossProcesses = true;
    await reset();
    stage = 'minute_cap';
    await owner`update ops.worker_gateway_rate_windows set admitted_count=20,minute_start=date_trunc('minute',clock_timestamp()),minute_count=28 where window_id=${windowId}::uuid`;
    const rate = await parallel(four('request.status', () => statusArgs));
    assertRace(
      rate.map((x) => x.state),
      { admitted: 2, limited: 2 },
      (await readFixture(owner)).admitted_count,
      22,
    );
    requireCondition(rate.filter((x) => x.code === 'rate_limited').length === 2, 'gw01_minute_cap');
    checks.minuteCapAcrossProcesses = true;
    await reset();
    stage = 'two_reservations';
    const leases = await parallel(four('identity.read'));
    assertRace(
      leases.map((x) => x.state),
      { admitted: 2, limited: 2 },
      (await readFixture(owner)).holders,
      2,
    );
    checks.twoReservationsAcrossProcesses = true;
    await reset();
    stage = 'same_key';
    const duplicate = await parallel(four('identity.read').map((x) => ({ ...x, id: 1 })));
    assertRace(
      duplicate.map((x) => x.state),
      { admitted: 1, in_flight: 3 },
      (await readFixture(owner)).requests,
      1,
    );
    checks.sameKeyAdmissionAcrossProcesses = true;
    await reset();
    stage = 'changed_args';
    const changed = await parallel([
      { action: 'admit', id: 1, operation: 'settings.read', args: { key: 'daily_budget_usd' } },
      { action: 'admit', id: 1, operation: 'settings.read', args: { key: 'stats_daily_enabled' } },
    ]);
    assertRace(
      changed.map((x) => x.state),
      { admitted: 1, conflict: 1 },
      (await readFixture(owner)).requests,
      1,
    );
    checks.changedArgsAcrossProcesses = true;
    await reset();
    stage = 'execution_parent_lock';
    await admit(owner, 20);
    await admit(owner, 21);
    const held = [20, 21].map((id) => {
      const w = spawnWorker({ action: 'hold', id, operation: 'identity.read', args: {} });
      children.push(w);
      return w;
    });
    await Promise.all(held.map((w) => w.start()));
    requireCondition(
      (await Promise.all(held.map((w) => w.wait('executed')))).every((x) => x.state === 'completed'),
      'gw01_two_execution_barrier',
    );
    const third = spawnWorker({ action: 'admit', id: 22, operation: 'identity.read', args: {} });
    children.push(third);
    await third.start();
    await waitForLock((await third.wait('querying')).backendPid);
    held.forEach((w) => w.release());
    await Promise.all(held.map((w) => w.done()));
    requireCondition((await third.done()).state === 'admitted', 'gw01_third_admission_after_release');
    checks.twoActiveExecutionTransactions = true;
    checks.thirdAdmissionWaitsForExecution = true;
    await reset();
    stage = 'atomic_commit';
    await admit(owner, 30, 'error.log', auditArgs(30));
    const atomic = spawnWorker({ action: 'hold', id: 30, operation: 'error.log', args: auditArgs(30) });
    children.push(atomic);
    await atomic.start();
    await atomic.wait('executed');
    requireCondition(
      (await status(owner, 30)).state === 'in_flight' && (await baseline(owner)).audits === original.audits,
      'gw01_uncommitted_visibility',
    );
    const concurrent = await parallel([
      { action: 'execute', id: 30, operation: 'error.log', args: auditArgs(30) },
    ]);
    requireCondition(concurrent[0].state === 'in_flight', 'gw01_duplicate_execution_blocked');
    atomic.release();
    await atomic.done();
    requireCondition(
      (await status(owner, 30)).state === 'completed' &&
        (await baseline(owner)).audits === original.audits + 1,
      'gw01_atomic_commit',
    );
    checks.atomicAuditAndReceiptCommit = true;
    checks.concurrentDuplicateExecutionBlocked = true;
    await reset();
    stage = 'after_commit_lost_response';
    await admit(owner, 31, 'error.log', auditArgs(31));
    await parallel([{ action: 'lost', id: 31, operation: 'error.log', args: auditArgs(31) }]);
    requireCondition((await status(owner, 31)).state === 'completed', 'gw01_lost_response_recovery');
    const replay = await writer(owner, (tx) => execute(tx, 31, 'error.log', auditArgs(31)));
    requireCondition(
      replay.state === 'completed' && (await baseline(owner)).audits === original.audits + 2,
      'gw01_lost_response_no_reexecute',
    );
    checks.afterCommitLostResponseReconciled = true;
    await reset();
    stage = 'before_commit_interruption';
    await admit(owner, 32, 'error.log', auditArgs(32));
    const interrupted = spawnWorker({ action: 'hold', id: 32, operation: 'error.log', args: auditArgs(32) });
    children.push(interrupted);
    await interrupted.start();
    await interrupted.wait('executed');
    await interrupted.kill();
    // Wait for the owned backend to observe transport closure and rollback.
    let closed = false;
    for (let i = 0; i < 100; i++) {
      const [row] =
        await owner`select count(*)::int as n from pg_stat_activity where application_name like 'gw01-local-worker-%'`;
      if (row.n === 0) {
        closed = true;
        break;
      }
      await delay(25);
    }
    requireCondition(
      closed && (await baseline(owner)).audits === original.audits + 2,
      'gw01_interrupted_rollback',
    );
    await owner`update ops.worker_gateway_requests set lease_expires_at=clock_timestamp()-interval '1 second' where window_id=${windowId}::uuid and request_id=${requestId(32)}::uuid`;
    requireCondition(
      (await status(owner, 32)).state === 'reconciliation_required',
      'gw01_interrupted_unknown',
    );
    requireCondition(
      (await writer(owner, (tx) => execute(tx, 32, 'error.log', auditArgs(32)))).state ===
        'reconciliation_required',
      'gw01_no_blind_replay',
    );
    checks.beforeCommitInterruptionRolledBack = true;
    checks.expiredUnknownRequiresReconciliation = true;
    await reset();
    stage = 'close_parent_lock';
    await admit(owner, 40);
    const closeHeld = spawnWorker({ action: 'hold', id: 40, operation: 'identity.read', args: {} });
    children.push(closeHeld);
    await closeHeld.start();
    await closeHeld.wait('executed');
    const closer = spawnWorker({ action: 'close', id: 41, operation: 'identity.read', args: {} });
    children.push(closer);
    await closer.start();
    await waitForLock((await closer.wait('querying')).backendPid);
    requireCondition((await readFixture(owner)).closed_at === null, 'gw01_close_cannot_ack_early');
    closeHeld.release();
    await closeHeld.done();
    requireCondition((await closer.done()).state === 'closed', 'gw01_close_after_commit');
    const [closedRequest] =
      await owner`select state from ops.worker_gateway_requests where request_id=${requestId(40)}::uuid`;
    requireCondition(closedRequest.state === 'completed', 'gw01_close_preserves_prior_commit');
    checks.closeWaitsForPriorExecutionCommit = true;
    await reset();
    stage = 'expiry_parent_lock';
    await admit(owner, 42, 'error.log', auditArgs(42));
    let markLocked;
    const locked = new Promise((resolve) => {
      markLocked = resolve;
    });
    const release = new Promise((resolve) => {
      releaseBarrier = resolve;
    });
    const barrierTask = barrier.begin(async (tx) => {
      await tx`update ops.worker_gateway_rate_windows set starts_at=statement_timestamp()-interval '30 minutes'+interval '700 milliseconds',
        expires_at=statement_timestamp()+interval '700 milliseconds' where window_id=${windowId}::uuid`;
      markLocked();
      await release;
    });
    await locked;
    const expired = spawnWorker({ action: 'execute', id: 42, operation: 'error.log', args: auditArgs(42) });
    children.push(expired);
    await expired.start();
    await waitForLock((await expired.wait('querying')).backendPid);
    await delay(850);
    releaseBarrier();
    await barrierTask;
    const expiredReceipt = await expired.done();
    requireCondition(
      expiredReceipt.state === 'closed' && expiredReceipt.code === 'window_expired',
      'gw01_expiry_after_lock_wait',
    );
    const [expiredRequest] =
      await owner`select state from ops.worker_gateway_requests where request_id=${requestId(42)}::uuid`;
    requireCondition(
      expiredRequest.state === 'reserved' && (await baseline(owner)).audits === original.audits + 2,
      'gw01_expiry_prevents_effect',
    );
    checks.expiryRefreshedAfterParentLockWait = true;
    const finalBaseline = await baseline(owner);
    requireCondition(finalBaseline.digest === original.digest, 'gw01_retained_baseline_changed');
    checks.originalHistoryAndDataPreserved = true;
    return {
      status: 'passed',
      checks,
      retainedAuditDelta: finalBaseline.audits - original.audits,
      fixtureBoundary: 'local_supabase_admin_session_authorization_simulation',
      boundaryCounterSetup: '100-cap starts98; minute-cap starts28; not100 actual network requests',
    };
  } catch (error) {
    const safe = new GatewayCheckFailure(
      error instanceof GatewayCheckFailure ? error.message : 'gw01_driver_failed',
    );
    safe.stage = stage;
    throw safe;
  } finally {
    releaseBarrier();
    await finalizeGatewayResources(async () => {
      await Promise.all(children.map((w) => w.kill()));
      checks.ownedChildrenClosed = true;
      if (fixtureOwned) {
        await clearOwnedFixture(owner);
        assertPristineGateway(await readFixture(owner));
        requireCondition((await baseline(owner)).digest === original.digest, 'gw01_cleanup_baseline_changed');
        checks.fixtureRestored = true;
      }
    }, [owner, barrier]);
    checks.databaseClientsClosed = true;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--worker' && process.send) await workerMain();
  else {
    try {
      process.stdout.write(JSON.stringify(await runGatewayConcurrency()) + '\n');
    } catch (error) {
      if (error instanceof GatewayCheckFailure)
        process.stderr.write(
          JSON.stringify({ status: 'failed', stage: error.stage ?? 'local_preflight', code: error.message }) +
            '\n',
        );
      else console.error('gw01_local_concurrency_failed');
      process.exitCode = 1;
    }
  }
}
