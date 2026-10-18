#!/usr/bin/env node
// Isolated local Supabase stack for the authenticated web e2e suite.
//
//   node apps/web/e2e/support/stack.mjs up     # start, migrate, seed fixtures, create test users
//   node apps/web/e2e/support/stack.mjs down   # stop and discard the isolated stack
//
// It copies supabase/ into a temporary workdir with its own project id and ports (613xx), so
// it never touches, resets or reads another local stack (such as the M03 one on 603xx) and
// never contacts a hosted project. Email/password sign-in is enabled ONLY in this temporary
// copy so tests obtain genuine sessions; the app itself offers Google sign-in only.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '../..');
const repoRoot = resolve(webRoot, '../..');
const projectId = 'emr-web-e2e';
const workdir = join(tmpdir(), projectId);
const stateDir = join(webRoot, 'e2e', '.stack');
const statePath = join(stateDir, 'state.json');
// The repository's pinned Supabase CLI (root devDependency), run directly with Node.
const cliPackage = createRequire(join(repoRoot, 'package.json')).resolve('supabase/package.json');
const supabaseCli = join(dirname(cliPackage), JSON.parse(readFileSync(cliPackage, 'utf8')).bin.supabase);
const EXCLUDE = 'realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';

function supabase(args, options = {}) {
  // CI passes the pinned setup-cli binary in SUPABASE_BIN; locally the root devDependency runs.
  const [command, prefix] = process.env.SUPABASE_BIN
    ? [process.env.SUPABASE_BIN, []]
    : [process.execPath, [supabaseCli]];
  return execFileSync(command, [...prefix, ...args, '--workdir', workdir], {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function prepareWorkdir() {
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(join(workdir, 'supabase'), { recursive: true });
  cpSync(join(repoRoot, 'supabase', 'migrations'), join(workdir, 'supabase', 'migrations'), {
    recursive: true,
  });
  const seed = [
    readFileSync(join(repoRoot, 'supabase', 'seed.sql'), 'utf8'),
    readFileSync(join(webRoot, 'e2e', 'fixtures', 'web-e2e.seed.sql'), 'utf8'),
  ].join('\n');
  writeFileSync(join(workdir, 'supabase', 'seed.sql'), seed);

  let config = readFileSync(join(repoRoot, 'supabase', 'config.toml'), 'utf8');
  config = config
    .replace(/^project_id = ".*"$/m, `project_id = "${projectId}"`)
    .replace(/(port = )60(\d{3})/g, '$161$2')
    .replace(/^site_url = ".*"$/m, 'site_url = "http://127.0.0.1:3100"')
    .replace(/^additional_redirect_urls = .*$/m, 'additional_redirect_urls = ["http://127.0.0.1:3100/**"]');
  // Enable email/password sign-in for genuine test sessions in this temporary copy only.
  config = config.replace(/(\[auth\.email\][\s\S]*?\nenable_signup = )false/, '$1true');
  if (!/\[auth\.email\][\s\S]*?\nenable_signup = true/.test(config))
    throw new Error('auth.email patch failed');
  if (/= 60\d{3}\b/.test(config)) throw new Error('port isolation patch failed');
  writeFileSync(join(workdir, 'supabase', 'config.toml'), config);
}

function status() {
  const out = supabase(['status', '-o', 'json'], { capture: true });
  return JSON.parse(out.slice(out.indexOf('{')));
}

async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${new URL(url).pathname} → ${response.status}`);
  return response.status === 204 ? null : response.json();
}

function psql(sql) {
  execFileSync(
    'docker',
    ['exec', `supabase_db_${projectId}`, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      stdio: 'ignore',
    },
  );
}

const FIXTURE_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text x="0" y="28" font-family="sans-serif" font-size="26" fill="#ffffff">fixture.</text></svg>`;

async function up() {
  prepareWorkdir();
  // Start output includes local keys, so it is captured and shown only on failure.
  try {
    supabase(['start', '--exclude', EXCLUDE], { capture: true });
  } catch (error) {
    const detail = String(error.stdout ?? '')
      .split(String.fromCharCode(10))
      .filter((line) => !line.includes('KEY'))
      .slice(-5);
    throw new Error(['Local stack start failed:', ...detail].join(' | '));
  }
  const s = status();
  const apiUrl = s.API_URL;
  const publishableKey = s.PUBLISHABLE_KEY;
  // Local stack admin key: used here only, in memory, against 127.0.0.1. Never written to disk.
  const secretKey = s.SECRET_KEY ?? s.SERVICE_ROLE_KEY;
  if (!/^http:\/\/127\.0\.0\.1:61\d{3}$/.test(apiUrl)) throw new Error('Unexpected local API URL');
  if (!/^sb_publishable_/.test(publishableKey ?? '')) throw new Error('Local publishable key unavailable');

  const admin = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const users = {};
  for (const role of ['member', 'admin', 'disabled', 'outsider']) {
    const email = `${role}@e2e.test`;
    const password = randomBytes(18).toString('base64url');
    await request(`${apiUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `E2E ${role}` },
      }),
    });
    users[role] = { email, password };
  }
  psql("update app.members set status = 'disabled' where email = 'disabled@e2e.test'");

  await request(`${apiUrl}/storage/v1/object/media/logos/fixture-baseline.svg`, {
    method: 'POST',
    headers: { ...admin, 'Content-Type': 'image/svg+xml', 'x-upsert': 'true' },
    body: FIXTURE_LOGO,
  });

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({ apiUrl, publishableKey, users }, null, 2));
  process.stdout.write(`Web e2e stack ready at ${apiUrl} (state: apps/web/e2e/.stack/state.json)\n`);
}

function down() {
  if (existsSync(join(workdir, 'supabase', 'config.toml'))) supabase(['stop', '--no-backup']);
  rmSync(workdir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
  process.stdout.write('Web e2e stack stopped and discarded\n');
}

const command = process.argv[2];
if (command === 'up') await up();
else if (command === 'down') down();
else {
  console.error('Usage: node apps/web/e2e/support/stack.mjs up|down');
  process.exit(1);
}
