import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { sha256 } from './files';
import { prodEmptyNames } from './prod-operations';
import { prodMigrationVersions } from './prod-model';
const root = fileURLToPath(new URL('../..', import.meta.url));
const safeEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (key) => (process.env[key] ? [[key, process.env[key]!]] : []),
    ),
  );
const publicFiles = [
  'scripts/package.json',
  'pnpm-lock.yaml',
  'scripts/seed/dev-batch-packet.json',
  'data/competitors.csv',
  'data/competitor_accounts.csv',
  'reference/taxonomies.json',
  'scripts/seed/overrides.csv',
  'assets/brand/everyone-logotype.svg',
  'scripts/seed/certs/supabase-root-2021.crt',
  'scripts/seed/certs/supabase-root-2021.json',
  'scripts/seed/prod-ca.json',
  'scripts/seed/prod-seed-packet.json',
  'scripts/seed/prod-payload.json',
  'scripts/seed/prod-logo-manifest.json',
  'scripts/assert/m02_counts.sql',
];
let fixture: string, artifact: string, guard: string, packet: Record<string, unknown>;
async function setPacket(value: Record<string, unknown>) {
  await writeFile(join(fixture, 'scripts/seed/prod-seed-packet.json'), JSON.stringify(value, null, 2) + '\n');
  const seal = JSON.parse(await readFile(join(artifact, 'prod-runner-seal.json'), 'utf8'));
  seal.files['scripts/seed/prod-seed-packet.json'] = sha256(
    await readFile(join(fixture, 'scripts/seed/prod-seed-packet.json')),
  );
  await writeFile(join(artifact, 'prod-runner-seal.json'), JSON.stringify(seal));
}
function run(action: string, extra: Record<string, string> = {}, runner = 'prod-runner.mjs') {
  return spawnSync(
    process.execPath,
    ['--import', pathToFileURL(guard).href, join(artifact, runner), action],
    {
      cwd: join(root, 'scripts'),
      env: { ...safeEnv(), ...extra },
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    },
  );
}
beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'emr-m02-prod-cli-'));
  artifact = await mkdtemp(join(root, 'scripts/seed/out/prod-cli-test-'));
  for (const path of publicFiles) {
    const destination = join(fixture, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, path), destination);
  }
  await mkdir(join(fixture, 'scripts/seed/out'), { recursive: true });
  packet = JSON.parse(await readFile(join(fixture, 'scripts/seed/prod-seed-packet.json'), 'utf8'));
  packet = { ...packet, approved: false, approvalReference: null };
  await writeFile(
    join(fixture, 'scripts/seed/prod-seed-packet.json'),
    JSON.stringify(packet, null, 2) + '\n',
  );
  guard = join(fixture, 'network-guard.mjs');
  await writeFile(
    guard,
    `import net from 'node:net';import tls from 'node:tls';import http from 'node:http';import https from 'node:https';import dns from 'node:dns';import {syncBuiltinESMExports} from 'node:module';const deny=()=>{throw new Error('TEST_NETWORK_FORBIDDEN')};net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;tls.connect=deny;http.request=deny;http.get=deny;https.request=deny;https.get=deny;dns.lookup=deny;dns.resolve=deny;dns.promises.lookup=deny;globalThis.fetch=deny;syncBuiltinESMExports();`,
  );
  const builder = pathToFileURL(join(root, 'scripts/seed/prod-build-runner.mjs')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `await (await import(${JSON.stringify(builder)})).buildProdRunner(${JSON.stringify(fixture)},${JSON.stringify(artifact)});`,
    ],
    { env: safeEnv(), cwd: join(root, 'scripts'), encoding: 'utf8', timeout: 15000, windowsHide: true },
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  // Fault injection uses the actual CLI source and only local fake DB/network modules.
  const fakeDb = join(artifact, 'fake-postgres.mjs');
  await writeFile(
    fakeDb,
    `export default function(){const sql=async(strings)=>{const text=strings.join('');if(text.includes('current_user'))return[{current_user:'postgres',session_user:'postgres',database:'postgres'}];if(text.includes('schema_migrations'))return ${JSON.stringify(prodMigrationVersions.map((version) => ({ version })))};if(text.includes("select 'competitors'"))return ${JSON.stringify(prodEmptyNames.map((name) => ({ name, count: '0' })))};if(text.includes('storage.buckets'))return[{public:true}];throw new Error('TEST_UNEXPECTED_SQL');};sql.end=async()=>{};return sql;}`,
  );
  const fakeNetwork = join(artifact, 'fake-network.mjs');
  await writeFile(
    fakeNetwork,
    "export async function safeRequest(){throw new Error('synthetic-private-error-not-for-output');}",
  );
  await build({
    entryPoints: [join(root, 'scripts/seed/prod-cli.ts')],
    outfile: join(artifact, 'fault-runner.mjs'),
    platform: 'node',
    format: 'esm',
    target: 'node24',
    bundle: true,
    external: ['sharp', 'csv-parse/sync', 'zod', '@supabase/supabase-js'],
    define: { EMR_REPO_ROOT: JSON.stringify(fixture) },
    plugins: [
      {
        name: 'local-fault-only',
        setup(plugin) {
          plugin.onResolve({ filter: /^postgres$/ }, () => ({ path: fakeDb }));
          plugin.onResolve({ filter: /^\.\/network$/ }, () => ({ path: fakeNetwork }));
        },
      },
    ],
    logLevel: 'silent',
  });
}, 30000);
beforeEach(async () => {
  for (const name of await readdir(join(fixture, 'scripts/seed/out')))
    await rm(join(fixture, 'scripts/seed/out', name));
  await setPacket(packet);
});
afterAll(async () => {
  for (const directory of [fixture, artifact])
    if (directory) {
      const actual = await realpath(directory);
      const expected = resolve(directory);
      if (
        actual !== expected ||
        ![
          resolve(tmpdir()) + sep + 'emr-m02-prod-cli-',
          resolve(root, 'scripts/seed/out') + sep + 'prod-cli-test-',
        ].some((prefix) => expected.startsWith(prefix))
      )
        throw new Error('Test cleanup boundary rejected');
      await rm(directory, { recursive: true });
    }
});
describe('actual sealed production CLI, isolated public fixture and network denied', () => {
  it('preflight validates public payload offline and reports current false approval', () => {
    const result = run('preflight');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'verified',
      environment: 'prod',
      projectRef: 'hkiafqrcxaafdbcvjlzv',
      approved: false,
    });
    expect(result.stderr).toBe('');
  });
  it('rejects unapproved apply and invalid command without creating actual-run receipts', async () => {
    for (const [action, code] of [
      ['apply', 'M02_PROD_APPROVAL_PENDING'],
      ['invalid', 'M02_PROD_COMMAND_REJECTED'],
    ]) {
      const result = run(action!);
      expect(result.status).toBe(1);
      expect(result.stderr.trim()).toBe(code);
    }
    expect(await readdir(join(fixture, 'scripts/seed/out'))).toEqual([]);
  });
  it('preflight rejects approved without real nonblank reference', async () => {
    for (const approvalReference of [null, '', '   ']) {
      await setPacket({ ...packet, approved: true, approvalReference });
      const result = run('preflight');
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/^M02_PROD_/);
    }
  });
  it('approved packet cannot authenticate without its two private inputs', async () => {
    await setPacket({ ...packet, approved: true, approvalReference: 'synthetic-local-approval' });
    const result = run('apply', {
      SEED_DATABASE_URL:
        'postgresql://postgres.hkiafqrcxaafdbcvjlzv@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
    });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('M02_PROD_CREDENTIAL_MISSING');
    expect(await readdir(join(fixture, 'scripts/seed/out'))).toEqual([]);
  });
  it('existing ambiguous state and original latest receipt remain byte-identical on rejected apply', async () => {
    await setPacket({ ...packet, approved: true, approvalReference: 'synthetic-local-approval' });
    const original = JSON.stringify({
      runId: 'original-run',
      stages: [{ name: 'production_logos', status: 'running' }],
      nativeCompletion: 'in_progress',
    });
    const out = join(fixture, 'scripts/seed/out');
    await writeFile(join(out, 'prod-latest.json'), original);
    await writeFile(join(out, 'prod-write-pending.json'), 'null');
    const result = run('apply');
    expect(result.stderr.trim()).toBe('M02_PROD_RECONCILIATION_REQUIRED');
    expect(await readFile(join(out, 'prod-latest.json'), 'utf8')).toBe(original);
    expect((await readdir(out)).sort()).toEqual(['prod-latest.json', 'prod-write-pending.json']);
  });
  it('simulated post-admission failure archives native failure and retains one-use/pending gates without raw errors', async () => {
    await setPacket({ ...packet, approved: true, approvalReference: 'synthetic-local-approval' });
    const result = run(
      'apply',
      {
        SEED_DATABASE_URL:
          'postgresql://postgres.hkiafqrcxaafdbcvjlzv@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
        PGPASSWORD: 'synthetic-db-only',
        SUPABASE_SECRET_KEY: 'synthetic-storage-only',
      },
      'fault-runner.mjs',
    );
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('M02_PROD_FROZEN_LOGO_REJECTED');
    expect(result.stdout).toBe('');
    const out = join(fixture, 'scripts/seed/out');
    const latest = JSON.parse(await readFile(join(out, 'prod-latest.json'), 'utf8'));
    expect(latest.nativeCompletion).toBe('failed');
    expect(latest.stages.at(-1)).toMatchObject({ name: 'frozen_dev_public_logos', status: 'blocked' });
    const archive = await readFile(join(out, `prod-receipt-${latest.runId}.json`), 'utf8');
    expect(JSON.parse(archive)).toEqual(latest);
    expect(await readdir(out)).toContain('prod-seed-admission.json');
    expect(await readdir(out)).toContain('prod-write-pending.json');
  });
});
