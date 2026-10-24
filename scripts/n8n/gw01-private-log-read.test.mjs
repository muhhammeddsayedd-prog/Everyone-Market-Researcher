import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const roots = [],
  ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const source = readFileSync('scripts/n8n/windows/Invoke-M03GW01LogRead.ps1', 'utf8');
const canary = 'SYNTHETIC_PROTECTION_ONLY_FOR_LOG_READ_0123456789';
const sha = (text) => createHash('sha256').update(text).digest('hex');
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture(mode = 'ok') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-private-log-read-'));
  roots.push(root);
  const put = (relative, text) => {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  const consumerPath = 'scripts/n8n/windows/Invoke-M03GW01LogRead.ps1';
  const consumer = put(consumerPath, source.replace('WaitForExit(30000)', 'WaitForExit(800)'));
  const preview = {
    version: 1,
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
    branch: 'm03-n8n-foundation',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticOwnedDeployment123',
    audience: 'https://everyone-market-researcher-synthetic.vercel.app',
    target: 'preview',
    protection: 'all_except_custom_domains',
    routeDisabledVerified: false,
  };
  const packet = {
    version: 1,
    windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
    requestId: '80162039-6088-4011-bdf1-a2a7b5ec11cb',
    attemptId: '66233386-4962-44fe-b499-df973fde25c9',
    reservedAt: 1792313741664,
    finishedAt: 1792313742950,
    httpStatus: 503,
  };
  put('scripts/n8n/gw01-reviewed-preview.json', JSON.stringify(preview));
  put(
    'scripts/n8n/gw01-trial-config.json',
    JSON.stringify({ windowId: packet.windowId, audiences: [preview.audience] }),
  );
  put('scripts/n8n/gw01-log-read-packet.json', JSON.stringify(packet));
  put('scripts/n8n/out/gw01/gw01-trial.jsonl', 'SYNTHETIC_PUBLIC_JOURNAL_NEVER_CHANGE\n');
  put('scripts/n8n/gw01-gateway-logs.mjs', '// synthetic public scanner source');
  put('scripts/n8n/gw01-trial.mjs', '// synthetic public coordinator source');
  put(
    'scripts/n8n/gw01-log-read.mjs',
    `import {writeFileSync} from 'node:fs';let s='';for await(const c of process.stdin)s+=c;const x=JSON.parse(s);if(process.env.SYNTHETIC_POISON)process.exit(1);if(process.argv[2]==='--check-public'){${mode === 'public_fail' ? 'process.exit(1);' : "process.stdout.write(JSON.stringify({version:1,status:'public_ready',gatewayRequests:0,logCliInvocations:0,privateRead:false}));"}}else{writeFileSync('synthetic-private-started.json','true');${mode === 'hang' ? 'setInterval(()=>{},1000);' : `const r={version:1,status:'verified',code:null,requestId:'${packet.requestId}',attemptId:'${packet.attemptId}',since:'${new Date(packet.reservedAt - 5000).toISOString()}',until:'${new Date(packet.finishedAt + 5000).toISOString()}',gatewayRequests:0,logCliInvocations:1,logScan:{version:1,status:'verified',code:null,capturedMatchingRequest:true,logsScanned:1,publicAuthMarkerFound:false,requestBodyMarkerFound:false,ownBypassFound:false,truncated:false,childClosed:true,observedAt:'${new Date(packet.finishedAt).toISOString()}'}};${mode === 'reflection' ? 'r.code=x.protection;' : ''}${mode === 'empty' ? "r.status='unverified';r.code='GW01_LOGS_NO_CAPTURE';r.logScan.status='unverified';r.logScan.code=r.code;r.logScan.capturedMatchingRequest=false;r.logScan.logsScanned=0;r.logScan.observedAt=null;process.exitCode=1;" : ''}${mode === 'stderr' ? 'process.stderr.write(x.protection);' : ''}${mode === 'array_scalar' ? 'r.requestId=[r.requestId];' : ''}process.stdout.write(JSON.stringify(r));`}}`,
  );
  const vercelRoot = 'fake-appdata/npm/node_modules/vercel';
  put(vercelRoot + '/package.json', '{"version":"56.5.0"}');
  put(vercelRoot + '/dist/index.js', '// synthetic public CLI');
  const oldFiles = {};
  for (const p of [
    'scripts/n8n/gw01-gateway-logs.mjs',
    'scripts/n8n/gw01-trial.mjs',
    'scripts/n8n/gw01-reviewed-preview.json',
    'scripts/n8n/gw01-trial-config.json',
  ])
    oldFiles[p] = sha(readFileSync(join(root, p)));
  const oldSeal = {
    version: 1,
    files: oldFiles,
    vercelFiles: {
      'package.json': sha(readFileSync(join(root, vercelRoot + '/package.json'))),
      'dist/index.js': sha(readFileSync(join(root, vercelRoot + '/dist/index.js'))),
    },
  };
  if (mode === 'old_version_boolean') oldSeal.version = true;
  if (mode === 'old_hash_boolean') oldSeal.files['scripts/n8n/gw01-trial.mjs'] = true;
  put('scripts/n8n/gw01-gateway-seal.json', JSON.stringify(oldSeal));
  const required = [
    consumerPath,
    'scripts/n8n/gw01-log-read.mjs',
    'scripts/n8n/gw01-log-read-packet.json',
    'scripts/n8n/gw01-gateway-seal.json',
    ...Object.keys(oldFiles),
  ];
  const files = {};
  for (const p of required) files[p] = sha(readFileSync(join(root, p)));
  put('scripts/n8n/gw01-log-read-seal.json', JSON.stringify({ version: 1, files }));
  if (mode === 'seal_drift') put('scripts/n8n/gw01-log-read-packet.json', '{}');
  const local = join(root, 'fake-localappdata');
  mkdirSync(join(local, 'Temp'), { recursive: true });
  const handoff = join(local, 'Temp/emr-m03-gw01-dev-protection.dpapi');
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  env.LOCALAPPDATA = local;
  env.APPDATA = join(root, 'fake-appdata');
  env.SYNTHETIC_POISON = 'must not inherit';
  const creation = spawnSync(
    ps,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$s=ConvertTo-SecureString -String '${canary}' -AsPlainText -Force;[IO.File]::WriteAllText('${handoff.replaceAll("'", "''")}',(ConvertFrom-SecureString $s));$s.Dispose()`,
    ],
    { env, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(creation.status, 0);
  if (mode === 'missing') rmSync(handoff);
  return {
    root,
    handoff,
    run: (args = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, ...args], {
        env,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      }),
  };
}
test('log reader public CheckOnly does not decrypt or start a private child', () => {
  const f = fixture(),
    r = f.run(['-CheckOnly']);
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.privateRead, false);
  assert.equal(v.status, 'check_only_ready');
  assert.equal(existsSync(join(f.root, 'synthetic-private-started.json')), false);
  assert.ok(existsSync(f.handoff));
});
test('log reader accepts one bounded metadata-only result and retains owned encrypted protection', () => {
  const f = fixture(),
    r = f.run();
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.privateRead, true);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.nativeExit, 0);
  assert.equal(v.status, 'verified');
  assert.ok(existsSync(f.handoff));
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
for (const mode of ['seal_drift', 'public_fail', 'missing', 'old_version_boolean', 'old_hash_boolean'])
  test('log reader blocks ' + mode + ' before private child', () => {
    const f = fixture(mode),
      r = f.run();
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.equal(v.privateRead, false);
    assert.equal(v.status, 'preflight_blocked');
    assert.equal(existsSync(join(f.root, 'synthetic-private-started.json')), false);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  });
for (const mode of ['reflection', 'empty', 'hang', 'array_scalar'])
  test('log reader keeps ' + mode + ' unverified with owned child closed', () => {
    const f = fixture(mode),
      r = f.run();
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.equal(v.rootChildClosed, true);
    assert.notEqual(v.status, 'verified');
    assert.ok(existsSync(f.handoff));
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  });
test('log reader discards native stderr rather than exposing its private value', () => {
  const r = fixture('stderr').run();
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
