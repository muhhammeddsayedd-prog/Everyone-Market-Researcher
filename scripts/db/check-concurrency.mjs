import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Synthetic fixtures on this project's verified local database only. Sessions
// use the local owner; pgTAP 04 separately proves n8n_writer privileges.
// https://www.postgresql.org/docs/17/app-psql.html
// https://www.postgresql.org/docs/17/monitoring-stats.html
const root = fileURLToPath(new URL('../../', import.meta.url));
const project = 'everyone-market-radar';
const container = `supabase_db_${project}`;
const marker = randomUUID();
const company = randomUUID();
const accounts = Array.from({ length: 4 }, () => randomUUID());
const runs = Array.from({ length: 4 }, () => randomUUID());
const companyCode = `M01CONC-${marker}`;
const companySlug = `m01-concurrency-${marker}`;
const appPrefix = `emr-conc-${marker}-`;
const names = ['natural', 'content-a', 'content-b'].map((name) => `${marker}-${name}`);
const page = `https://example.test/${marker}/work`;
const sessions = [];
const checks = {};
const childEnv = { ...process.env };
const psqlArgs = [
  'psql',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-X',
  '-q',
  '-t',
  '-A',
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  'VERBOSITY=sqlstate',
];
let verifiedContainerId;
let fixtureAttempted = false;
let fixtureCreated = false;
let cleanup = 'not-needed';
let failure = null;

class CheckFailure extends Error {}
function requireCondition(condition, stage) {
  if (!condition) throw new CheckFailure(stage);
}
function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function list(values) {
  return values.map(literal).join(',');
}
function parseJson(value, stage) {
  try {
    return JSON.parse(value);
  } catch {
    throw new CheckFailure(stage);
  }
}
function run(args, stage, input) {
  const result = spawnSync('docker', args, {
    cwd: root,
    env: childEnv,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  requireCondition(!result.error && result.status === 0, stage);
  return result.stdout.trim();
}
function sql(statement, stage) {
  return run(['exec', '-i', container, ...psqlArgs], stage, statement);
}
function verifyLocalIdentity() {
  const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
  requireCondition(/^project_id\s*=\s*"everyone-market-radar"\s*$/m.test(config), 'config-project');
  const dbConfig = config.split(/^\[db\]\s*$/m)[1]?.split(/^\[/m)[0];
  requireCondition(/^port\s*=\s*60322\s*$/m.test(dbConfig ?? ''), 'config-db-port');
  const context = parseJson(run(['context', 'inspect'], 'docker-context'), 'docker-context-json');
  requireCondition(
    /^(unix:\/\/\/|npipe:\/\/)/.test(context[0]?.Endpoints?.docker?.Host ?? ''),
    'docker-context-local',
  );
  requireCondition(
    !childEnv.DOCKER_HOST || /^(unix:\/\/\/|npipe:\/\/)/.test(childEnv.DOCKER_HOST),
    'docker-host-local',
  );
  const inspected = parseJson(run(['inspect', container], 'container-inspect'), 'container-json')[0];
  requireCondition(inspected?.Config?.Labels?.['com.supabase.cli.project'] === project, 'container-project');
  requireCondition(
    inspected?.NetworkSettings?.Ports?.['5432/tcp']?.some((port) => port.HostPort === '60322'),
    'container-port',
  );
  requireCondition(inspected?.State?.Running === true, 'container-running');
  if (verifiedContainerId)
    requireCondition(inspected.Id === verifiedContainerId, 'container-identity-changed');
  verifiedContainerId = inspected.Id;
  const identity = parseJson(
    sql(
      `select jsonb_build_object('database',current_database(),'role',current_user,
    'major',current_setting('server_version_num')::int/10000,
    'pipeline',to_regprocedure('ingest.upsert_raw_items(uuid,uuid,jsonb)') is not null);`,
      'database-identity',
    ),
    'database-identity-json',
  );
  requireCondition(
    identity.database === 'postgres' &&
      identity.role === 'postgres' &&
      identity.major === 17 &&
      identity.pipeline,
    'database-identity-match',
  );
}

class Session {
  constructor(name) {
    this.name = `${appPrefix}${name}`;
    this.closed = false;
    this.settled = false;
    this.backendPid = null;
    this.buffer = '';
    this.stderr = '';
    this.pending = null;
    this.child = spawn('docker', ['exec', '-i', '-e', `PGAPPNAME=${this.name}`, container, ...psqlArgs], {
      cwd: root,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdin.on('error', () => this.reject('worker-input'));
    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      if (this.buffer.length > 1024 * 1024) return this.reject('worker-output-limit');
      let end;
      while ((end = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end + 1);
        if (!this.pending) continue;
        if (line === this.pending.tag) {
          const pending = this.pending;
          this.pending = null;
          clearTimeout(pending.timer);
          if (pending.expectedState) pending.reject(new CheckFailure('expected-sqlstate-not-raised'));
          else pending.resolve(pending.lines);
        } else if (line) this.pending.lines.push(line);
      }
    });
    this.child.stderr.on('data', (chunk) => {
      this.stderr = (this.stderr + chunk).slice(-16_384);
    });
    this.child.on('error', () => this.reject('worker-spawn'));
    this.child.on('exit', (code) => {
      this.closed = true;
      if (!this.pending) return;
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      if (
        code === 3 &&
        pending.expectedState &&
        new RegExp(`\\b${pending.expectedState}\\b`).test(this.stderr)
      ) {
        pending.resolve({ sqlstate: pending.expectedState });
      } else pending.reject(new CheckFailure(pending.stage));
    });
    this.child.on('close', () => {
      this.closed = true;
      this.settled = true;
    });
    sessions.push(this);
  }
  reject(stage) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(new CheckFailure(stage));
  }
  command(statement, stage, expectedState) {
    requireCondition(!this.pending && !this.closed, 'worker-state');
    this.stderr = '';
    return new Promise((resolve, reject) => {
      const tag = `DONE_${randomUUID().replaceAll('-', '')}`;
      const timer = setTimeout(() => this.reject(stage), 12_000);
      this.pending = { tag, stage, expectedState, timer, lines: [], resolve, reject };
      this.child.stdin.write(`${statement}\n\\echo ${tag}\n`);
    });
  }
  async identify() {
    const lines = await this.command('select pg_backend_pid();', 'worker-identity');
    requireCondition(lines.length === 1 && /^\d+$/.test(lines[0]), 'worker-backend-pid');
    this.backendPid = Number(lines[0]);
  }
  waitForClose(milliseconds) {
    if (this.settled) return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = (closed) => {
        clearTimeout(timer);
        this.child.off('close', onClose);
        resolve(closed);
      };
      const onClose = () => finish(true);
      const timer = setTimeout(() => finish(false), milliseconds);
      this.child.once('close', onClose);
    });
  }
  async close() {
    // The verified database backend is terminated first in finally. Even if
    // identity verification fails, bound teardown of our own spawned handles.
    try {
      this.reject('worker-shutdown');
      if (!this.closed && !this.child.stdin.destroyed) this.child.stdin.end('\\q\n');
      if (await this.waitForClose(300)) return true;
      this.child.kill('SIGTERM');
      if (await this.waitForClose(700)) return true;
      this.child.kill('SIGKILL');
      return await this.waitForClose(300);
    } finally {
      this.child.stdin.destroy();
      this.child.stdout.destroy();
      this.child.stderr.destroy();
      this.child.unref();
    }
  }
}

function value(lines, stage) {
  requireCondition(Array.isArray(lines) && lines.length === 1, stage);
  return parseJson(lines[0], stage);
}
async function waitUntilBlocked(session, blocker, stage) {
  requireCondition(session.backendPid && blocker.backendPid, 'barrier-backend-identities');
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const waiting = sql(
      `select count(*) from pg_stat_activity waiting join pg_stat_activity blocker
        on blocker.pid=${blocker.backendPid} and blocker.application_name=${literal(blocker.name)}
      where waiting.pid=${session.backendPid} and waiting.datname='postgres' and waiting.usename='postgres'
        and waiting.application_name=${literal(session.name)} and waiting.wait_event_type='Lock'
        and blocker.pid=any(pg_blocking_pids(waiting.pid));`,
      stage,
    );
    if (waiting === '1') return;
    requireCondition(!session.closed, stage);
    await delay(25);
  }
  throw new CheckFailure(stage);
}
const begin = "begin; set local statement_timeout='10s'; set local lock_timeout='8s';";
function normalized(id, caption, thumbnail) {
  return {
    platform: 'news',
    external_id: id,
    actor: 'm01-local-synthetic-fixture',
    item_type: 'news_article',
    url: `https://example.test/${id}`,
    published_at: new Date().toISOString(),
    caption,
    thumbnail_url: thumbnail,
    payload: { m01_concurrency_fixture: marker },
    metrics: {},
  };
}
function ingest(account, item) {
  return `select ingest.upsert_raw_items(${literal(runs[2])},${literal(account)},${literal(JSON.stringify([item]))}::jsonb);`;
}
function itemCounts(ids) {
  return parseJson(
    sql(
      `with owned as (select i.id from app.items i where i.competitor_id=${literal(company)}
    and i.external_id in (${list(ids)})) select jsonb_build_object(
      'rawRows',(select count(*) from ingest.raw_items r where r.account_id in (${list(accounts)}) and r.external_id in (${list(ids)})),
      'shellRows',(select count(*) from owned),
      'aiMessages',(select count(*) from pgmq.q_ai_extract q where q.message->>'item_id' in (select id::text from owned)),
      'mediaMessages',(select count(*) from pgmq.q_media q where q.message->>'item_id' in (select id::text from owned)));`,
      'fixture-item-counts',
    ),
    'fixture-count-json',
  );
}
async function race(firstAccount, firstItem, secondAccount, secondItem, name) {
  const first = new Session(`${name}-a`);
  const second = new Session(`${name}-b`);
  await first.identify();
  await second.identify();
  const firstResult = value(
    await first.command(`${begin}\n${ingest(firstAccount, firstItem)}`, `${name}-first`),
    `${name}-first-json`,
  );
  const pending = second.command(`${begin}\n${ingest(secondAccount, secondItem)}`, `${name}-second`);
  pending.catch(() => {});
  // Observe the loser waiting on a real database lock before committing winner.
  await waitUntilBlocked(second, first, `${name}-barrier`);
  await first.command('commit;', `${name}-first-commit`);
  const secondResult = value(await pending, `${name}-second-json`);
  await second.command('commit;', `${name}-second-commit`);
  return [firstResult, secondResult];
}

try {
  verifyLocalIdentity();
  fixtureAttempted = true;
  sql(
    `${begin}
    select pg_advisory_xact_lock(1662701);
    do $$ begin
      if exists (select 1 from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
        where a.platform='news' and a.status in ('active','failing') and c.status='active'
          and a.next_due_at<=now() and a.backfill_status in ('done','not_applicable')
          and (a.locked_until is null or a.locked_until<=now())) then
        raise exception 'other eligible news accounts exist';
      end if;
    end $$;
    insert into app.competitors (id,company_code,slug,name,priority_tier,notes) values
      (${literal(company)},${literal(companyCode)},${literal(companySlug)},'M01 synthetic concurrency fixture','baseline',${literal(marker)});
    insert into ops.scrape_runs (id,workflow,platform,mode,env,n8n_execution_id) values
      (${literal(runs[0])},'M01-concurrency','news','daily','dev',${literal(marker)}),
      (${literal(runs[1])},'M01-concurrency','news','daily','dev',${literal(marker)}),
      (${literal(runs[2])},'M01-concurrency','news','daily','dev',${literal(marker)}),
      (${literal(runs[3])},'M01-concurrency','website_work_page','daily','dev',${literal(marker)});
    insert into app.competitor_accounts (id,competitor_id,platform,handle,url,next_due_at,backfill_status) values
      (${literal(accounts[0])},${literal(company)},'news',${literal(`${marker}-a`)},'https://example.test/a','-infinity','done'),
      (${literal(accounts[1])},${literal(company)},'news',${literal(`${marker}-b`)},'https://example.test/b','-infinity','done'),
      (${literal(accounts[2])},${literal(company)},'website_work_page',${literal(`${marker}-site-a`)},'https://example.test/site-a','infinity','done'),
      (${literal(accounts[3])},${literal(company)},'website_work_page',${literal(`${marker}-site-b`)},'https://example.test/site-b','infinity','done');
    commit;`,
    'fixture-setup',
  );
  fixtureCreated = true;

  const workerA = new Session('claim-a');
  const workerB = new Session('claim-b');
  await workerA.identify();
  await workerB.identify();
  const claimedA = value(
    await workerA.command(
      `${begin}
    select coalesce(jsonb_agg(q.account_id),'[]') from ops.get_due_accounts('news',1,${literal(runs[0])},'daily') q;`,
      'claim-a',
    ),
    'claim-a-json',
  );
  const claimedB = value(
    await workerB.command(
      `${begin}
    select coalesce(jsonb_agg(q.account_id),'[]') from ops.get_due_accounts('news',1,${literal(runs[1])},'daily') q;`,
      'claim-b',
    ),
    'claim-b-json',
  );
  requireCondition(
    claimedA.length === 1 &&
      claimedB.length === 1 &&
      claimedA[0] !== claimedB[0] &&
      accounts.slice(0, 2).includes(claimedA[0]) &&
      accounts.slice(0, 2).includes(claimedB[0]),
    'claim-overlap',
  );
  requireCondition(
    sql(
      `select count(*) from pg_stat_activity where application_name=${literal(workerA.name)}
    and datname='postgres' and state='idle in transaction';`,
      'claim-a-open',
    ) === '1',
    'claim-a-still-open',
  );
  checks.skipLocked = {
    passed: true,
    workerAClaims: 1,
    workerBClaims: 1,
    overlap: 0,
    workerARemainedOpen: true,
  };
  await workerA.command('rollback;', 'claim-a-rollback');
  await workerB.command('rollback;', 'claim-b-rollback');

  const claimed = parseJson(
    sql(
      `select coalesce(jsonb_agg(q.account_id),'[]') from
    ops.get_due_accounts('news',2,${literal(runs[2])},'daily') q;`,
      'ingest-claim',
    ),
    'ingest-claim-json',
  );
  requireCondition(
    claimed.length === 2 && claimed.every((id) => accounts.slice(0, 2).includes(id)),
    'ingest-owned-claims',
  );
  const naturalItem = normalized(
    names[0],
    `Natural identity fixture ${marker}`,
    `https://example.test/${marker}/natural.jpg`,
  );
  const natural = await race(accounts[0], naturalItem, accounts[0], naturalItem, 'natural');
  const naturalCounts = itemCounts([names[0]]);
  requireCondition(
    natural[0].inserted + natural[1].inserted === 1 &&
      naturalCounts.rawRows === 1 &&
      naturalCounts.shellRows === 1 &&
      naturalCounts.aiMessages === 1 &&
      naturalCounts.mediaMessages === 1,
    'natural-idempotency',
  );
  checks.naturalIdempotency = {
    passed: true,
    lockBarrierObserved: true,
    insertedAcrossWorkers: 1,
    ...naturalCounts,
  };

  const caption = `Content identity fixture ${marker}`;
  const thumbnail = `https://example.test/${marker}/content.jpg`;
  const content = await race(
    accounts[0],
    normalized(names[1], caption, thumbnail),
    accounts[1],
    normalized(names[2], caption, thumbnail),
    'content',
  );
  const contentCounts = itemCounts(names.slice(1));
  requireCondition(
    content[0].inserted + content[1].inserted === 1 &&
      content[0].duplicates + content[1].duplicates === 1 &&
      contentCounts.rawRows === 2 &&
      contentCounts.shellRows === 2 &&
      contentCounts.aiMessages === 1 &&
      contentCounts.mediaMessages === 1,
    'content-idempotency',
  );
  checks.contentIdempotency = {
    passed: true,
    lockBarrierObserved: true,
    insertedAcrossWorkers: 1,
    duplicates: 1,
    ...contentCounts,
  };

  // Set only these synthetic website fixtures' claim state. The due-list test
  // above uses the real RPC; this setup avoids claiming the existing web seed.
  sql(
    `${begin}
    update app.competitor_accounts set last_run_id=${literal(runs[3])},locked_until=now()+interval '2 hours'
      where id in (${list(accounts.slice(2))}) and competitor_id=${literal(company)};
    commit;`,
    'website-fixture-claims',
  );
  const websiteA = new Session('website-a');
  const websiteB = new Session('website-b');
  await websiteA.identify();
  await websiteB.identify();
  const urlsA = value(
    await websiteA.command(
      `${begin}
    select to_jsonb(ops.diff_website_urls(${literal(accounts[2])},array[${literal(page)}]));`,
      'website-first',
    ),
    'website-first-json',
  );
  requireCondition(urlsA.length === 1 && urlsA[0] === page, 'website-first-discovery');
  const websitePending = websiteB.command(
    `${begin}
    select to_jsonb(ops.diff_website_urls(${literal(accounts[3])},array[${literal(page)}]));`,
    'website-second',
    '22023',
  );
  websitePending.catch(() => {});
  await waitUntilBlocked(websiteB, websiteA, 'website-barrier');
  await websiteA.command('commit;', 'website-first-commit');
  const websiteResult = await websitePending;
  requireCondition(
    websiteResult.sqlstate === '22023' &&
      sql(
        `select count(*) from app.website_pages where competitor_id=${literal(company)} and url=${literal(page)};`,
        'website-owner-count',
      ) === '1',
    'website-cross-account-conflict',
  );
  checks.websiteOwnership = {
    passed: true,
    lockBarrierObserved: true,
    storedPages: 1,
    loserSqlstate: '22023',
  };
} catch (error) {
  failure = error instanceof CheckFailure ? error.message : 'concurrency-execution';
} finally {
  if (fixtureAttempted) {
    try {
      verifyLocalIdentity();
      if (sessions.length)
        sql(
          `select pg_terminate_backend(pid) from pg_stat_activity where datname='postgres' and usename='postgres'
        and application_name in (${list(sessions.map((session) => session.name))}) and pid<>pg_backend_pid();`,
          'owned-session-cleanup',
        );
      // All database sessions are now terminated; their transactions roll back.
      // OS child teardown below still runs when identity or SQL cleanup fails.
      const remaining = parseJson(
        sql(
          `${begin}
        do $$ begin
          if not exists (select 1 from app.competitors where id=${literal(company)} and company_code=${literal(companyCode)}
              and slug=${literal(companySlug)} and notes=${literal(marker)}) then
            if exists (select 1 from app.competitors where id=${literal(company)}) or ${fixtureCreated ? 'true' : 'false'} then
              raise exception 'fixture ownership mismatch';
            end if;
            return;
          end if;
          if exists (select 1 from app.competitor_accounts where competitor_id=${literal(company)} and id not in (${list(accounts)}))
            or exists (select 1 from app.items where competitor_id=${literal(company)} and
              (account_id not in (${list(accounts)}) or external_id not in (${list(names)})))
            or exists (select 1 from ingest.raw_items where account_id in (${list(accounts)}) and external_id not in (${list(names)}))
            or exists (select 1 from app.website_pages where competitor_id=${literal(company)}
              and (account_id not in (${list(accounts)}) or url<>${literal(page)}))
            or exists (select 1 from ops.scrape_runs where id in (${list(runs)}) and
              (workflow<>'M01-concurrency' or n8n_execution_id is distinct from ${literal(marker)}))
            or exists (select 1 from ops.scrape_run_accounts where
              (run_id in (${list(runs)}) and account_id not in (${list(accounts)}))
              or (account_id in (${list(accounts)}) and run_id not in (${list(runs)})))
            or exists (select 1 from app.media_assets where competitor_id=${literal(company)}
              or item_id in (select id from app.items where competitor_id=${literal(company)}))
            or exists (select 1 from app.employee_snapshots where competitor_id=${literal(company)}
              or account_id in (${list(accounts)}))
            or exists (select 1 from app.stats_daily where competitor_id=${literal(company)})
            or exists (select 1 from app.item_credits where competitor_id=${literal(company)}
              or item_id in (select id from app.items where competitor_id=${literal(company)}))
            or exists (select 1 from app.campaign_items where item_id in
              (select id from app.items where competitor_id=${literal(company)}))
            or exists (select 1 from ops.ai_extractions where item_id in
              (select id from app.items where competitor_id=${literal(company)}))
            or exists (select 1 from ops.cost_ledger where competitor_id=${literal(company)}
              or run_id in (${list(runs)})
              or item_id in (select id from app.items where competitor_id=${literal(company)}))
            or exists (select 1 from app.embeddings where (entity_type='competitor' and entity_id=${literal(company)})
              or (entity_type='item' and entity_id in (select id from app.items where competitor_id=${literal(company)}))) then
            raise exception 'fixture contains unowned rows';
          end if;
          delete from pgmq.q_ai_extract q where q.message->>'item_id' in (select id::text from app.items where competitor_id=${literal(company)});
          delete from pgmq.q_media q where q.message->>'item_id' in (select id::text from app.items where competitor_id=${literal(company)});
          delete from pgmq.a_ai_extract q where q.message->>'item_id' in (select id::text from app.items where competitor_id=${literal(company)});
          delete from pgmq.a_media q where q.message->>'item_id' in (select id::text from app.items where competitor_id=${literal(company)});
          delete from app.website_pages where competitor_id=${literal(company)} and account_id in (${list(accounts)}) and url=${literal(page)};
          delete from app.items where competitor_id=${literal(company)} and account_id in (${list(accounts)}) and external_id in (${list(names)});
          delete from ingest.raw_items where account_id in (${list(accounts)}) and external_id in (${list(names)});
          delete from ops.scrape_run_accounts where run_id in (${list(runs)}) and account_id in (${list(accounts)});
          delete from app.competitor_accounts where competitor_id=${literal(company)} and id in (${list(accounts)});
          delete from app.competitors where id=${literal(company)} and company_code=${literal(companyCode)} and notes=${literal(marker)};
          delete from ops.scrape_runs where id in (${list(runs)}) and workflow='M01-concurrency' and n8n_execution_id=${literal(marker)};
        end $$;
        select jsonb_build_object('competitors',(select count(*) from app.competitors where id=${literal(company)}),
          'accounts',(select count(*) from app.competitor_accounts where id in (${list(accounts)})),
          'runs',(select count(*) from ops.scrape_runs where id in (${list(runs)})),
          'raw',(select count(*) from ingest.raw_items where external_id in (${list(names)})),
          'items',(select count(*) from app.items where external_id in (${list(names)})),
          'pages',(select count(*) from app.website_pages where url=${literal(page)}));
        commit;`,
          'fixture-cleanup',
        ),
        'fixture-cleanup-json',
      );
      requireCondition(
        Object.values(remaining).every((count) => count === 0),
        'fixture-cleanup-remaining',
      );
      cleanup = 'OK';
    } catch {
      cleanup = 'FAIL';
      failure ??= 'fixture-cleanup';
    }
  }
  const closed = await Promise.allSettled(sessions.map((session) => session.close()));
  if (closed.some((result) => result.status !== 'fulfilled' || result.value !== true)) {
    failure ??= 'owned-worker-shutdown';
  }
}

const result = {
  check: 'concurrency-local',
  observedAt: new Date().toISOString(),
  scope: 'synthetic-local-fixtures',
  passed: !failure,
  checks,
  cleanup,
  ...(failure ? { failure } : {}),
};
writeFileSync(
  join(root, 'milestones/M01-supabase-foundation/evidence/local-concurrency.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (failure) process.exitCode = 1;
