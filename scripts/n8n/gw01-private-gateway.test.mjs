import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  roots = [];
const protection = 'SYNTHETIC_PRIVATE_PROTECTION_CANARY_0123456789',
  machine = 'SYNTHETIC_PRIVATE_MACHINE_CANARY_0123456789';
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
const source = readFileSync('scripts/n8n/windows/Invoke-M03GW01Gateway.ps1', 'utf8');
function fixture(scenario = 'ok', mode = 'Probe') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-private-gateway-'));
  roots.push(root);
  const put = (name, text) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  const consumer = put(
    'scripts/n8n/windows/Invoke-M03GW01Gateway.ps1',
    source
      .replace('WaitForExit(35000)', 'WaitForExit(800)')
      .replace('WaitForExit(60000)', 'WaitForExit(800)')
      .replace(
        '$start.FileName=$node;',
        scenario === 'start_failed'
          ? "$start.FileName=if($Private){Join-Path $repo 'synthetic-missing-node.exe'}else{$node};"
          : '$start.FileName=$node;',
      ),
  );
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
    routeDisabledVerified: mode === 'Request',
  };
  put('scripts/n8n/gw01-reviewed-preview.json', JSON.stringify(preview));
  put(
    'scripts/n8n/gw01-trial-config.json',
    JSON.stringify({ windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780', audiences: [preview.audience] }),
  );
  put(
    'scripts/n8n/gw01-local-privacy.json',
    JSON.stringify({ version: 1, passed: true, consumerReviewed: true, canaryTestsPassed: true }),
  );
  put(
    'scripts/n8n/gw01-cloud-privacy.json',
    JSON.stringify({
      version: 1,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      instanceHost: 'muhhammedsayed.app.n8n.cloud',
      passed: mode === 'Request',
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      logCanaryVerified: mode === 'Request',
      ownedWorkflowId: 'SyntheticOwned',
    }),
  );
  const request = {
    version: 1,
    requestId: '5f517a63-e9df-45cc-8751-9662ecb09c9a',
    operation: 'identity.read',
    args: {},
  };
  put('scripts/n8n/out/gw01/request.json', JSON.stringify(request));
  put('scripts/n8n/out/gw01/gw01-trial.jsonl', 'Synthetic public journal fixture only\n');
  const runner = `
    let s='';for await(const c of process.stdin)s+=c;const x=JSON.parse(s);
    if(process.env.SYNTHETIC_POISON)process.exit(1);
    if(process.argv[2]==='--check-public')process.stdout.write(JSON.stringify({version:1,status:'public_ready',networkRequests:0,privateRead:false}));
    else { ${
      scenario === 'hang'
        ? 'setInterval(()=>{},1000);'
        : `
      const r={version:1,mode:x.mode,status:'complete',code:null,requestId:x.request.requestId,operation:x.request.operation,kind:x.kind,attemptRecorded:true,httpStatus:503,tlsVerified:true,headersReceived:true,socketsClosed:true,disabledRouteVerified:true,identityVerified:false,response:{requestId:null,error:{code:'unavailable'}},logScan:{version:1,status:'verified',code:null,capturedMatchingRequest:true,logsScanned:1,publicAuthMarkerFound:false,requestBodyMarkerFound:false,ownBypassFound:false,truncated:false,childClosed:true,observedAt:'2026-10-18T08:00:10.000Z'}};
      if(x.mode==='Request'){r.httpStatus=200;r.disabledRouteVerified=false;r.identityVerified=true;r.logScan=null;r.response={version:1,requestId:x.request.requestId,outcome:'completed',result:{currentUser:'n8n_writer',sessionUser:'n8n_writer',database:'postgres',projectRef:'zmotjsbzhzjvpelxvxlf',connectionCount:1},window:{}};}
      ${scenario === 'reflection' ? 'r.requestId=x.secrets.protection;' : ''}
      ${scenario === 'stderr' ? 'process.stderr.write(x.secrets.protection);' : ''}
      ${scenario === 'extra' ? 'r.unreviewed=x.secrets.protection;' : ''}
      ${scenario === 'native' ? 'process.exitCode=1;' : ''}
      ${scenario === 'log_pending' ? 'r.logScan.status="unverified";r.logScan.code="GW01_LOGS_NO_CAPTURE";r.logScan.logsScanned=0;r.logScan.capturedMatchingRequest=false;r.logScan.observedAt=null;process.exitCode=1;' : ''}
      ${scenario === 'unknown' ? 'r.status="stopped_reconcile";r.code="GW01_GATEWAY_AFTER_HEADERS_CANCELLED";r.httpStatus=200;r.response=null;r.disabledRouteVerified=false;r.logScan=null;process.exitCode=1;' : ''}
      process.stdout.write(JSON.stringify(r));
    `
    }}
  `;
  put('scripts/n8n/gw01-gateway-transport.mjs', runner);
  for (const file of [
    'scripts/n8n/gw01-gateway-logs.mjs',
    'scripts/n8n/gw01-trial.mjs',
    'packages/shared/src/n8n-worker-contracts.ts',
    'pnpm-lock.yaml',
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
  ])
    put(file, '// Synthetic public source fixture only.');
  put('packages/shared/package.json', '{"type":"module"}');
  put('node_modules/.pnpm/zod@4.6.7/node_modules/zod/package.json', '{"version":"4.6.7","type":"module"}');
  put(
    'node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js',
    '// Synthetic public dependency fixture only.',
  );
  mkdirSync(join(root, 'packages/shared/node_modules'), { recursive: true });
  symlinkSync(
    join(root, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod'),
    join(root, 'packages/shared/node_modules/zod'),
    'junction',
  );
  const files = [
    'scripts/n8n/gw01-gateway-transport.mjs',
    'scripts/n8n/gw01-gateway-logs.mjs',
    'scripts/n8n/gw01-trial.mjs',
    'packages/shared/src/n8n-worker-contracts.ts',
    'packages/shared/package.json',
    'pnpm-lock.yaml',
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    'scripts/n8n/windows/Invoke-M03GW01Gateway.ps1',
    'scripts/n8n/gw01-reviewed-preview.json',
    'scripts/n8n/gw01-trial-config.json',
    'scripts/n8n/gw01-local-privacy.json',
    'scripts/n8n/gw01-cloud-privacy.json',
    'node_modules/.pnpm/zod@4.6.7/node_modules/zod/package.json',
    'node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js',
  ];
  const vercelRelative = 'fake-appdata/npm/node_modules/vercel';
  put(vercelRelative + '/package.json', '{"version":"56.5.0","type":"module"}');
  put(vercelRelative + '/dist/index.js', '// Synthetic public log reader fixture only.');
  put(
    'scripts/n8n/gw01-gateway-seal.json',
    JSON.stringify({
      version: 1,
      files: Object.fromEntries(
        files.map((p) => [
          p,
          createHash('sha256')
            .update(readFileSync(join(root, p)))
            .digest('hex'),
        ]),
      ),
      vercelFiles: Object.fromEntries(
        ['package.json', 'dist/index.js'].map((p) => [
          p,
          createHash('sha256')
            .update(readFileSync(join(root, vercelRelative, p)))
            .digest('hex'),
        ]),
      ),
    }),
  );
  const local = join(root, 'private');
  mkdirSync(join(local, 'Temp'), { recursive: true });
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  env.LOCALAPPDATA = local;
  env.APPDATA = join(root, 'fake-appdata');
  env.SYNTHETIC_POISON = 'NEVER_INHERIT_SYNTHETIC_PRIVATE_ENV';
  const save = put(
    'save-synthetic.ps1',
    `$p=ConvertTo-SecureString '${protection}' -AsPlainText -Force;$p|ConvertFrom-SecureString|Set-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-gw01-dev-protection.dpapi') -Encoding ASCII;$p.Dispose();${mode === 'Request' ? `$m=ConvertTo-SecureString '${machine}' -AsPlainText -Force;$m|ConvertFrom-SecureString|Set-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-gw01-dev-machine.dpapi') -Encoding ASCII;$m.Dispose();` : ''}`,
  );
  const saved = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', save], {
    env,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(saved.status, 0);
  return {
    root,
    local,
    consumer,
    put,
    env,
    run: (extra = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, '-Mode', mode, ...extra], {
        env,
        encoding: 'utf8',
        timeout: 20000,
        windowsHide: true,
      }),
  };
}
function result(f, extra = []) {
  const r = f.run(extra);
  assert.doesNotMatch(
    r.stdout + r.stderr,
    new RegExp(protection + '|' + machine + '|NEVER_INHERIT_SYNTHETIC_PRIVATE_ENV'),
  );
  return { r, v: JSON.parse(r.stdout) };
}
test('Probe decrypts protection only, uses sparse childenv and retains owned handoff for later phases', () => {
  const f = fixture(),
    { r, v } = result(f);
  assert.equal(r.status, 0);
  assert.equal(v.result.disabledRouteVerified, true);
  assert.equal(v.result.identityVerified, false);
  assert.equal(v.privateRead, true);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, true);
  assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-machine.dpapi')), false);
});
test('CheckOnly proves public seals/gates/presence only and preserves encrypted handoff', () => {
  const f = fixture(),
    { r, v } = result(f, ['-CheckOnly']);
  assert.equal(r.status, 0);
  assert.equal(v.status, 'check_only_ready');
  assert.equal(v.privateRead, false);
  assert.equal(v.result, null);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
});
for (const scenario of ['reflection', 'extra', 'native', 'hang', 'start_failed'])
  test(
    'bounded private wrapper withholds ' +
      scenario +
      ' and confirms child closure without deleting trial ownership',
    () => {
      const f = fixture(scenario),
        { r, v } = result(f);
      assert.equal(r.status, 1);
      assert.equal(v.status, 'stopped_reconcile');
      assert.equal(v.result, null);
      assert.equal(v.rootChildClosed, true);
      assert.equal(v.handoffsRetained, true);
      assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
    },
  );
test('private rawstderr is discarded', () => {
  const f = fixture('stderr'),
    { r, v } = result(f);
  assert.equal(r.status, 0);
  assert.equal(v.rootChildClosed, true);
});
test('verified503 remains recorded when captured log evidence is pending', () => {
  const f = fixture('log_pending'),
    { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.status, 'privacy_pending');
  assert.equal(v.result.disabledRouteVerified, true);
  assert.equal(v.result.logScan.status, 'unverified');
  assert.equal(v.result.identityVerified, false);
});
test('Request consumes only machine and protection after fullprivacy, with no writer or administrator handoff', () => {
  const f = fixture('ok', 'Request'),
    { r, v } = result(f);
  assert.equal(r.status, 0);
  assert.equal(v.result.identityVerified, true);
  assert.equal(v.result.logScan, null);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-machine.dpapi')));
  assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi')), false);
  assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-admin.dpapi')), false);
});
test('fixed unknown fault receipt remains separate from a verified gateway result', () => {
  const f = fixture('unknown'),
    { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.result.code, 'GW01_GATEWAY_AFTER_HEADERS_CANCELLED');
  assert.equal(v.result.response, null);
  assert.equal(v.result.identityVerified, false);
});
test('mutated sealed code blocks before private read', () => {
  const f = fixture();
  f.put('scripts/n8n/gw01-trial.mjs', '// changed');
  const { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.status, 'preflight_blocked');
  assert.equal(v.privateRead, false);
});
test('new unsealed runtime dependency code blocks before private read', () => {
  const f = fixture();
  f.put('node_modules/.pnpm/zod@4.6.7/node_modules/zod/new.js', '// unsealed');
  const { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.privateRead, false);
});
test('shared dependency junction must resolve to the sealed physical runtime', () => {
  const f = fixture();
  rmSync(join(f.root, 'packages/shared/node_modules/zod'));
  const other = join(f.root, 'other-runtime');
  mkdirSync(other);
  symlinkSync(other, join(f.root, 'packages/shared/node_modules/zod'), 'junction');
  const { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.privateRead, false);
});
test('missing protection file blocks without requesting another credential', () => {
  const f = fixture();
  rmSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi'));
  const { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.privateRead, false);
});
test('Request requires complete Cloudprivacy and machine handoff independently of Probe', () => {
  const f = fixture('ok', 'Request');
  rmSync(join(f.local, 'Temp/emr-m03-gw01-dev-machine.dpapi'));
  const { r, v } = result(f);
  assert.equal(r.status, 1);
  assert.equal(v.privateRead, false);
});
