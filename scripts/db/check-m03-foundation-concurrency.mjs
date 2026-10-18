import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { assertDockerIdentity, dockerChildEnvironment } from './check-m03-concurrency.mjs';
import { fixedGatewayConnectionOptions } from './check-gw01-concurrency.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
class CheckFailure extends Error {}
function demand(value, code) {
  if (!value) throw new CheckFailure(code);
}
export function foundationCheckAdmission(args, env, config) {
  const local = args.length === 2 && args[0] === '--local' && args[1] === '--gateway-only';
  const ci = args.length === 1 && args[0] === '--ci' && env.CI === 'true' && env.GITHUB_ACTIONS === 'true';
  demand(local || ci, 'm03_foundation_local_admission');
  demand(/^project_id\s*=\s*"everyone-market-radar"\s*$/m.test(config), 'm03_foundation_local_config');
  demand(
    /^port\s*=\s*60322\s*$/m.test(config.split(/^\[db\]\s*$/m)[1]?.split(/^\[/m)[0] ?? ''),
    'm03_foundation_local_config',
  );
  demand(
    !env.DOCKER_HOST || /^(unix:\/\/\/|npipe:\/\/)/.test(env.DOCKER_HOST),
    'm03_foundation_remote_docker',
  );
  return { actor: ci, gateway: true };
}
export function checkFoundationRace(results, count, overlap) {
  demand(
    results.length === 2 &&
      results.filter((v) => v === true).length === 1 &&
      results.filter((v) => v === false).length === 1 &&
      count === 1 &&
      overlap === true,
    'm03_foundation_actor_race',
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
  demand(!r.error && r.status === 0, 'm03_foundation_docker');
  return r.stdout;
}
function verifyDocker(env, previous) {
  const context = JSON.parse(docker(['context', 'inspect'], env));
  demand(
    /^(unix:\/\/\/|npipe:\/\/)/.test(context[0]?.Endpoints?.docker?.Host ?? ''),
    'm03_foundation_remote_docker',
  );
  const container = JSON.parse(docker(['inspect', 'supabase_db_everyone-market-radar'], env))[0];
  return assertDockerIdentity(context, container, previous);
}
async function snapshot(c) {
  const [r] = await c`select md5(jsonb_build_object(
    'history',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m),
    'competitors',(select jsonb_agg(to_jsonb(x) order by id) from app.competitors x),
    'accounts',(select jsonb_agg(to_jsonb(x) order by id) from app.competitor_accounts x),
    'items',(select jsonb_agg(to_jsonb(x) order by id) from app.items x),
    'runs',(select jsonb_agg(to_jsonb(x) order by id) from ops.scrape_runs x),
    'costs',(select jsonb_agg(to_jsonb(x) order by id) from ops.cost_ledger x),
    'audit',(select jsonb_agg(to_jsonb(x) order by id) from ops.audit_log x),
    'oldwindow',(select jsonb_agg(to_jsonb(x) order by window_id) from ops.worker_gateway_rate_windows x),
    'oldrequests',(select jsonb_agg(to_jsonb(x) order by request_id) from ops.worker_gateway_requests x),
    'oldleases',(select jsonb_agg(to_jsonb(x) order by slot) from ops.worker_gateway_leases x))::text) as hash`;
  return r.hash;
}
async function waitForLocks(observer, names, minimum) {
  for (let i = 0; i < 100; i++) {
    const [r] =
      await observer`select count(*)::int as n from pg_stat_activity where application_name=any(${names}) and wait_event_type='Lock'`;
    if (r.n >= minimum) return true;
    await delay(10);
  }
  return false;
}
export async function runFoundationConcurrency(args = process.argv.slice(2), env = process.env) {
  const mode = foundationCheckAdmission(
    args,
    env,
    readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8'),
  );
  const marker = randomUUID(),
    audience = `https://everyone-market-researcher-${marker}.vercel.app`;
  const names = ['owner', 'barrier', 'observer', 'first', 'second'].map(
    (x) => `m03-foundation-${marker.slice(0, 20)}-${x}`,
  );
  const clients = [],
    checks = {};
  let owned = false,
    fixture = false,
    baseline,
    target,
    failed;
  const ids = Array.from({ length: 12 }, () => randomUUID()),
    company = randomUUID(),
    account = randomUUID(),
    launch = randomUUID();
  const runIds = [],
    pendingTasks = [];
  let owner, barrier, observer, first, second;
  let releaseActorBarrier = async () => {};
  try {
    target = verifyDocker(env);
    for (const name of names) clients.push(postgres(fixedGatewayConnectionOptions(name)));
    [owner, barrier, observer, first, second] = clients;
    const [identity] =
      await owner`select current_database() as database,current_user as principal,current_setting('server_version_num')::int as version`;
    demand(
      identity.database === 'postgres' &&
        identity.principal === 'supabase_admin' &&
        Math.floor(identity.version / 10000) === 17,
      'm03_foundation_database_identity',
    );
    const [empty] =
      await owner`select (select count(*) from ops.foundation_gateway_rate_windows)::int as windows,
      (select count(*) from ops.apify_launch_approvals)::int as approvals,(select count(*) from ops.apify_launch_admissions)::int as launches`;
    demand(
      empty.windows === 0 && empty.approvals === 0 && empty.launches === 0,
      'm03_foundation_existing_window',
    );
    if (mode.actor) {
      const [existing] =
        await owner`select count(*)::int as n from app.competitors where company_code='C999' or slug='emr-smoke-test'`;
      demand(existing.n === 0, 'm03_foundation_ci_fixture_conflict');
    }
    baseline = await snapshot(owner);
    await owner`select ops.foundation_gateway_provision(${owner.json({
      audience,
      commitSha: 'a'.repeat(40),
      deploymentId: 'dpl_M03Concurrency',
      approvalReference: `local-concurrency-${marker}`,
      actorBuild: '0.3.99',
      maxTotalChargeUsd: 0.1,
      batchMaxUsd: 0.2,
    })}::jsonb)`;
    owned = true;
    for (const c of [first, second]) await c.unsafe('set session authorization n8n_writer');
    const admit = async (c, id, op = 'identity.read', a = {}) =>
      (
        await c`select ops.foundation_gateway_admit(${windowId}::uuid,${id}::uuid,${op},${c.json(a)}::jsonb,'admit') as r`
      )[0].r;
    const execute = async (c, id, op = 'identity.read', a = {}) =>
      (
        await c`select ops.foundation_gateway_execute(${windowId}::uuid,${id}::uuid,${op},${c.json(a)}::jsonb) as r`
      )[0].r;
    demand(
      (await admit(first, ids[0])).state === 'admitted' && (await admit(second, ids[1])).state === 'admitted',
      'm03_foundation_reservations',
    );
    demand((await admit(first, ids[2])).code === 'concurrency_limit', 'm03_foundation_third_reservation');
    const concurrent = await Promise.all([execute(first, ids[0]), execute(second, ids[1])]);
    demand(
      concurrent.every((r) => r.state === 'completed'),
      'm03_foundation_two_executes',
    );
    checks.maxTwoReservations = true;

    const execution = `concurrency-${marker}`;
    const error = {
      entry: {
        kind: 'notify',
        workflow: 'WF-99',
        execution_id: execution,
        node: 'Notify',
        message: 'notify_threshold_reached',
      },
    };
    demand(
      (await admit(first, ids[3], 'error.log', error)).state === 'admitted',
      'm03_foundation_duplicate_admit',
    );
    const lock = `emr-error:WF-99:${execution}:Notify:notify_logged`;
    await barrier`select pg_advisory_lock(hashtextextended(${lock},0))`;
    const firstPending = execute(first, ids[3], 'error.log', error);
    pendingTasks.push(firstPending);
    firstPending.catch(() => {});
    const overlapping = await waitForLocks(observer, [names[3]], 1);
    demand(overlapping, 'm03_foundation_duplicate_overlap');
    const duplicate = await execute(second, ids[3], 'error.log', error);
    demand(duplicate.state === 'in_flight', 'm03_foundation_duplicate_busy');
    await barrier`select pg_advisory_unlock(hashtextextended(${lock},0))`;
    demand((await firstPending).state === 'completed', 'm03_foundation_duplicate_commit');
    const [audit] =
      await owner`select count(*)::int as n from ops.audit_log where actor_type='n8n' and action='notify_logged'
      and entity_id='WF-99' and after->>'execution_id'=${execution}`;
    demand(audit.n === 1, 'm03_foundation_single_audit');
    checks.overlappingDuplicateSingleSideEffect = true;
    // Deliberately discard the completed return: status, rather than another
    // business execute/new ID, recovers the already committed outcome.
    const [recovered] =
      await second`select ops.foundation_gateway_status(${windowId}::uuid,${ids[3]}::uuid) as r`;
    demand(
      recovered.r.state === 'completed' &&
        recovered.r.operation === 'error.log' &&
        recovered.r.replayed === true,
      'm03_foundation_dropped_ack_recovery',
    );
    checks.committedResultRecoveredByReadback = true;

    if (mode.actor) {
      await owner.begin(async (tx) => {
        await tx`insert into app.competitors(id,company_code,slug,name,priority_tier) values(${company}::uuid,'C999','emr-smoke-test',${'M03 concurrency ' + marker},'adjacent')`;
        await tx`insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
          values(${account}::uuid,${company}::uuid,'website_work_page',${'m03-concurrency-' + marker},'https://everyone.film/about-everyone','pending')`;
        await tx`insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after) values('system','m03_smoke_setup.v1',
          'm03_smoke_fixture_created','competitor',${company},${tx.json({ fixture_version: 1, project_ref: 'zmotjsbzhzjvpelxvxlf', competitor_id: company, account_id: account })}::jsonb)`;
      });
      fixture = true;
      for (let i = 0; i < 2; i++) {
        const request = {
          workflow: 'WF-99',
          platform: 'website_work_page',
          mode: 'manual',
          env: 'dev',
          executionId: `actor-${i}-${marker}`,
        };
        demand(
          (await admit(first, ids[4 + i], 'run.start', request)).state === 'admitted',
          'm03_foundation_actor_parent_admit',
        );
        const r = await execute(first, ids[4 + i], 'run.start', request);
        demand(r.state === 'completed', 'm03_foundation_actor_parent');
        runIds.push(r.result.run_id);
      }
      const [{ input }] = await owner`select ops.m03_smoke_launch_input() as input`;
      const a = {
        launch: {
          window_id: windowId,
          launch_id: launch,
          run_id: runIds[0],
          account_id: account,
          execution_id: `actor-0-${marker}`,
          actor_id: 'aYG0l9s7dbB7j3gbS',
          actor_build: '0.3.99',
          input,
          memory_mb: 1024,
          timeout_seconds: 300,
          max_total_charge_usd: 0.1,
        },
      };
      demand(
        (await admit(first, ids[6], 'launch.authorize', a)).state === 'admitted' &&
          (await admit(second, ids[7], 'launch.authorize', a)).state === 'admitted',
        'm03_foundation_actor_reservations',
      );
      const held = await barrier.reserve();
      await held.unsafe('begin');
      let released = false;
      releaseActorBarrier = async () => {
        if (!released) {
          released = true;
          try {
            await held.unsafe('rollback');
          } finally {
            held.release();
          }
        }
      };
      await held`select id from ops.scrape_runs where id=${runIds[0]}::uuid for update`;
      const p1 = execute(first, ids[6], 'launch.authorize', a),
        p2 = execute(second, ids[7], 'launch.authorize', a);
      pendingTasks.push(p1, p2);
      p1.catch(() => {});
      p2.catch(() => {});
      const actorOverlap = await waitForLocks(observer, [names[3], names[4]], 2);
      await releaseActorBarrier();
      const r = await Promise.all([p1, p2]);
      const [n] =
        await owner`select count(*)::int as n from ops.apify_launch_admissions where window_id=${windowId}::uuid`;
      checkFoundationRace(
        r.map((x) => x.result?.authorized),
        n.n,
        actorOverlap,
      );
      checks.overlappingActorOnePostPermit = true;
      const next = {
        launch: {
          ...a.launch,
          launch_id: randomUUID(),
          run_id: runIds[1],
          execution_id: `actor-1-${marker}`,
        },
      };
      demand(
        (await admit(first, ids[8], 'launch.authorize', next)).state === 'admitted',
        'm03_foundation_unknown_admit',
      );
      demand(
        (await execute(first, ids[8], 'launch.authorize', next)).state === 'rejected',
        'm03_foundation_ambiguous_blocks_next',
      );
      checks.unknownOriginalPreventsAnotherLaunch = true;
    }
    const [closed] =
      await first`select ops.foundation_gateway_admit(${windowId}::uuid,${ids[9]}::uuid,'identity.read','{}','close') as r`;
    demand(
      closed.r.state === 'closed' && (await admit(first, ids[10])).code === 'window_closed',
      'm03_foundation_closed_denial',
    );
    checks.closedNeverReopens = true;
  } catch (error) {
    failed = error instanceof CheckFailure ? error.message : 'm03_foundation_execution_failed';
  } finally {
    try {
      await releaseActorBarrier();
    } catch {
      failed ??= 'm03_foundation_actor_barrier_cleanup';
    }
    if (barrier) {
      try {
        await barrier`select pg_advisory_unlock_all()`;
      } catch {
        failed ??= 'm03_foundation_barrier_cleanup';
      }
    }
    await Promise.allSettled(pendingTasks);
    await Promise.allSettled([first, second].filter(Boolean).map((c) => c.end({ timeout: 2 })));
    if (owned && owner) {
      try {
        verifyDocker(env, target);
        await owner.begin(async (tx) => {
          const [w] =
            await tx`select bound_audience from ops.foundation_gateway_rate_windows where window_id=${windowId}::uuid for update`;
          demand(w?.bound_audience === audience, 'm03_foundation_cleanup_ownership');
          if (fixture) {
            const [c] =
              await tx`select name from app.competitors where id=${company}::uuid and company_code='C999' and slug='emr-smoke-test' for update`;
            demand(c?.name === 'M03 concurrency ' + marker, 'm03_foundation_fixture_ownership');
            demand(
              (await tx`select count(*)::int as n from app.items where competitor_id=${company}::uuid`)[0]
                .n === 0,
              'm03_foundation_no_collected_deletion',
            );
            const [ownedAccount] = await tx`select last_run_id from app.competitor_accounts
              where id=${account}::uuid and competitor_id=${company}::uuid for update`;
            demand(
              ownedAccount &&
                (ownedAccount.last_run_id === null || runIds.includes(ownedAccount.last_run_id)),
              'm03_foundation_account_ownership',
            );
            await tx`update app.competitor_accounts set last_run_id=null,locked_until=null
              where id=${account}::uuid and competitor_id=${company}::uuid`;
          }
          await tx`update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=${windowId}::uuid`;
          await tx`delete from ops.foundation_gateway_requests where window_id=${windowId}::uuid and request_id=any(${ids}::uuid[])`;
          await tx`delete from ops.foundation_gateway_leases where window_id=${windowId}::uuid`;
          await tx`delete from ops.apify_launch_admissions where window_id=${windowId}::uuid and launch_id=${launch}::uuid`;
          await tx`delete from ops.foundation_gateway_run_bindings where window_id=${windowId}::uuid and run_id=any(${runIds}::uuid[])`;
          await tx`delete from ops.scrape_runs where id=any(${runIds}::uuid[]) and env='dev' and workflow='WF-99'`;
          await tx`delete from ops.apify_launch_approvals where window_id=${windowId}::uuid and approval_reference=${'local-concurrency-' + marker}`;
          await tx`delete from ops.foundation_gateway_rate_windows where window_id=${windowId}::uuid and bound_audience=${audience}`;
          await tx`delete from ops.audit_log where actor_type='n8n' and action='notify_logged' and entity_id='WF-99' and after->>'execution_id'=${'concurrency-' + marker}`;
          if (fixture) {
            await tx`delete from ops.audit_log where actor_type='system' and actor_id='m03_smoke_setup.v1' and action='m03_smoke_fixture_created'
              and entity_id=${company} and after->>'account_id'=${account}`;
            await tx`delete from app.competitor_accounts where id=${account}::uuid and competitor_id=${company}::uuid`;
            await tx`delete from app.competitors where id=${company}::uuid and name=${'M03 concurrency ' + marker}`;
          }
        });
        demand((await snapshot(owner)) === baseline, 'm03_foundation_baseline_changed');
        checks.ownedFixtureRemovedAndBaselinePreserved = true;
      } catch {
        failed ??= 'm03_foundation_cleanup_failed';
      }
    }
    const ended = await Promise.allSettled(clients.map((c) => c.end({ timeout: 2 })));
    if (ended.some((r) => r.status === 'rejected')) failed ??= 'm03_foundation_clients_not_closed';
    else checks.databaseClientsClosed = true;
  }
  return {
    check: 'm03-foundation-concurrency',
    observedAt: new Date().toISOString(),
    passed: !failed,
    scope: mode.actor ? 'ci-owned-no-seed-local-fixture' : 'owned-local-gateway-only',
    checks,
    actorConcurrency: mode.actor ? 'executed' : 'not-run-existing-fixture-preserved',
    principalBoundary: 'local-session-authorization-simulation-not-restricted-network-login',
    ...(failed ? { failure: failed } : {}),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await runFoundationConcurrency();
    process.stdout.write(JSON.stringify(r) + '\n');
    if (!r.passed) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        passed: false,
        failure: error instanceof CheckFailure ? error.message : 'm03_foundation_preflight_failed',
      }) + '\n',
    );
    process.exitCode = 1;
  }
}
