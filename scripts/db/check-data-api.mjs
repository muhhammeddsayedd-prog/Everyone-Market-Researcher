import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local AC9 probe only. Never print status output, child-process errors, keys,
// JWTs, authorization headers, or response bodies. No service key is used.
const root = fileURLToPath(new URL('../../', import.meta.url));
const project = 'everyone-market-radar';
const apiPort = '60321';
const dbPort = '60322';
const memberId = '90000000-0000-0000-0000-000000000001';
const outsiderId = '90000000-0000-0000-0000-000000000002';
const memberEmail = 'm01-data-api-member@example.test';
const outsiderEmail = 'm01-data-api-outsider@example.test';
const signupEmail = 'm01-data-api-signup@example.test';
const fixtureId = '99900000-0000-0000-0000-000000000101';
const ownerMarker = randomUUID();
const dbContainer = `supabase_db_${project}`;
const statuses = {};
const childEnv = { ...process.env };
delete childEnv.SUPABASE_CLI_BINARY_OVERRIDE;

class ProbeFailure extends Error {}

function requireCondition(condition, stage) {
  if (!condition) throw new ProbeFailure(stage);
}

function run(command, args, stage, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: childEnv,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 25_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  requireCondition(!result.error && result.status === 0, stage);
  return result.stdout.trim();
}

function json(text, stage) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProbeFailure(stage);
  }
}

function configPort(config, section) {
  const lines = config.split(/\r?\n/);
  let selected = false;
  for (const line of lines) {
    if (/^\[/.test(line.trim())) selected = line.trim() === `[${section}]`;
    if (selected) {
      const match = line.match(/^port\s*=\s*(\d+)\s*(?:#.*)?$/);
      if (match) return match[1];
    }
  }
  return null;
}

function verifyDockerIdentity() {
  // Refuse remote Docker contexts before any SQL, including cleanup. Only the
  // local Unix socket or Windows named pipe can own this probe's containers.
  const endpoint = run(
    'docker',
    ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
    'docker-context',
  );
  requireCondition(/^(unix:\/\/\/|npipe:\/\/)/.test(endpoint), 'docker-context-local');
  requireCondition(
    !childEnv.DOCKER_HOST || /^(unix:\/\/\/|npipe:\/\/)/.test(childEnv.DOCKER_HOST),
    'docker-host-local',
  );
  for (const container of [dbContainer, `supabase_kong_${project}`]) {
    const label = run(
      'docker',
      ['inspect', '--format', '{{index .Config.Labels "com.supabase.cli.project"}}', container],
      'container-project',
    );
    requireCondition(label === project, 'container-project-match');
  }
  const dbPorts = json(
    run('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', dbContainer], 'db-ports'),
    'db-ports-json',
  );
  const gatewayPorts = json(
    run(
      'docker',
      ['inspect', '--format', '{{json .NetworkSettings.Ports}}', `supabase_kong_${project}`],
      'api-ports',
    ),
    'api-ports-json',
  );
  requireCondition(
    dbPorts['5432/tcp']?.some((binding) => binding.HostPort === dbPort),
    'db-port-match',
  );
  requireCondition(
    gatewayPorts['8000/tcp']?.some((binding) => binding.HostPort === apiPort),
    'api-port-match',
  );
}

function sql(statement, stage) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      dbContainer,
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
    ],
    stage,
    statement,
  );
}

function jwt(secret, id, email, origin) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    role: 'authenticated',
    sub: id,
    email,
    iss: `${origin}/auth/v1`,
    iat: now,
    exp: now + 120,
  })}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

async function request(apiUrl, apiKey, token, schema, path, name) {
  const response = await fetch(new URL(path, apiUrl), {
    headers: { apikey: apiKey, Authorization: `Bearer ${token}`, 'Accept-Profile': schema },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  statuses[name] = response.status;
  return { status: response.status, body: json(await response.text(), 'response-json') };
}

let fixtureAttempted = false;
let fixtureCreated = false;
let cleanup = 'not-needed';
let failure = null;

try {
  const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
  requireCondition(/^project_id\s*=\s*"everyone-market-radar"\s*$/m.test(config), 'config-project');
  requireCondition(configPort(config, 'api') === apiPort, 'config-api-port');
  requireCondition(configPort(config, 'db') === dbPort, 'config-db-port');
  verifyDockerIdentity();

  const status = json(
    run(
      process.execPath,
      [join(root, 'node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'],
      'local-status',
    ),
    'local-status-json',
  );
  const apiUrl = new URL(status.API_URL);
  requireCondition(
    apiUrl.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(apiUrl.hostname) &&
      apiUrl.port === apiPort &&
      !apiUrl.username &&
      !apiUrl.password &&
      apiUrl.pathname === '/',
    'local-api-identity',
  );
  const databaseUrl = new URL(status.DB_URL);
  requireCondition(
    ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) && databaseUrl.port === dbPort,
    'local-db-identity',
  );
  const apiKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  requireCondition(typeof apiKey === 'string' && apiKey.length > 20, 'publishable-key');
  if (!apiKey.startsWith('sb_publishable_')) {
    const claims = json(Buffer.from(apiKey.split('.')[1] ?? '', 'base64url').toString(), 'anon-claims');
    requireCondition(claims.role === 'anon', 'anon-role');
  }
  requireCondition(
    typeof status.JWT_SECRET === 'string' && status.JWT_SECRET.length >= 32,
    'local-jwt-signing',
  );

  fixtureAttempted = true;
  sql(
    `begin;
     set local statement_timeout = '10s';
     set local lock_timeout = '3s';
     select pg_advisory_xact_lock(900001);
     do $$ begin
       if exists (select 1 from auth.users where id in ('${memberId}','${outsiderId}')
         or email in ('${memberEmail}','${outsiderEmail}','${signupEmail}'))
         or exists (select 1 from app.member_invites where email in ('${memberEmail}','${outsiderEmail}','${signupEmail}')) then
         raise exception 'probe fixture identity already exists';
       end if;
     end $$;
     insert into app.member_invites(email,role) values('${memberEmail}','viewer');
     insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
       ('${memberId}','${memberEmail}',now(),jsonb_build_object('m01_data_api_probe','${ownerMarker}')),
       ('${outsiderId}','${outsiderEmail}',now(),jsonb_build_object('m01_data_api_probe','${ownerMarker}'));
     commit;`,
    'fixture-setup',
  );
  fixtureCreated = true;
  const memberToken = jwt(status.JWT_SECRET, memberId, memberEmail, apiUrl.origin);
  const outsiderToken = jwt(status.JWT_SECRET, outsiderId, outsiderEmail, apiUrl.origin);
  const fixturePath = `/rest/v1/items?select=id,title&id=eq.${fixtureId}`;
  const member = await request(apiUrl, apiKey, memberToken, 'app', fixturePath, 'member-app');
  requireCondition(
    member.status === 200 &&
      Array.isArray(member.body) &&
      member.body.length === 1 &&
      member.body[0].id === fixtureId &&
      member.body[0].title === 'Ramadan telecom film',
    'member-app-fixture',
  );
  const outsider = await request(apiUrl, apiKey, outsiderToken, 'app', fixturePath, 'nonmember-app');
  requireCondition(
    outsider.status === 200 && Array.isArray(outsider.body) && outsider.body.length === 0,
    'nonmember-app-denied',
  );
  for (const schema of ['ops', 'ingest', 'api', 'private']) {
    const hidden = await request(apiUrl, apiKey, memberToken, schema, '/rest/v1/', `hidden-${schema}`);
    requireCondition(hidden.status === 406 && hidden.body?.code === 'PGRST106', `hidden-${schema}-denied`);
  }
  // The baseline invite must never be claimable through unverified email
  // signup. Require the provider-disabled error specifically: validation or
  // rate-limit failures alone do not prove that email signup is disabled.
  const signup = await fetch(new URL('/auth/v1/signup', apiUrl), {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: signupEmail,
      password: `${randomBytes(24).toString('base64url')}aA1!`,
      data: { m01_data_api_probe: ownerMarker },
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  statuses['email-signup'] = signup.status;
  const signupBody = json(await signup.text(), 'signup-response-json');
  requireCondition(
    signup.status >= 400 && signup.status < 500 && signupBody.error_code === 'email_provider_disabled',
    'email-signup-disabled',
  );
  requireCondition(
    sql(`select count(*) from auth.users where email = '${signupEmail}';`, 'signup-no-user') === '0',
    'email-signup-created-no-user',
  );
} catch (error) {
  failure = error instanceof ProbeFailure ? error.message : 'probe-execution';
} finally {
  if (fixtureAttempted) {
    try {
      verifyDockerIdentity();
      const removed = sql(
        `set statement_timeout = '10s'; set lock_timeout = '3s';
         with removed as (
           delete from auth.users where (
             (((id = '${memberId}' and email = '${memberEmail}')
               or (id = '${outsiderId}' and email = '${outsiderEmail}'))
               and raw_app_meta_data->>'m01_data_api_probe' = '${ownerMarker}')
             or (email = '${signupEmail}'
               and raw_user_meta_data->>'m01_data_api_probe' = '${ownerMarker}')
           ) returning id
         ) select count(*) from removed where id in ('${memberId}','${outsiderId}');`,
        'fixture-cleanup',
      );
      requireCondition(!fixtureCreated || removed === '2', 'fixture-cleanup-count');
      requireCondition(
        sql(`select count(*) from auth.users where email = '${signupEmail}';`, 'signup-cleanup') === '0',
        'signup-cleanup-count',
      );
      cleanup = 'OK';
    } catch {
      cleanup = 'FAIL';
      failure ??= 'fixture-cleanup';
    }
  }
}

process.stdout.write(
  `${JSON.stringify({ check: 'data-api-local', passed: !failure, statuses, cleanup, ...(failure ? { failure } : {}) })}\n`,
);
if (failure) process.exitCode = 1;
