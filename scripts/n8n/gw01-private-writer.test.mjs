import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const roots = [],
  ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  canary = 'SYNTHETIC_WRITER_PRIVATE_GW01';
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
function fixture(mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-writer-fixture-'));
  roots.push(root);
  const put = (p, s) => {
    const target = join(root, p);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, s);
    return target;
  };
  const consumer = put(
    'scripts/n8n/windows/Invoke-M03GW01Writer.ps1',
    readFileSync('scripts/n8n/windows/Invoke-M03GW01Writer.ps1', 'utf8').replace(
      '$privateInput 60000',
      '$privateInput 1000',
    ),
  );
  const creator = put(
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    readFileSync('scripts/n8n/windows/New-M03GW01Handoff.ps1', 'utf8').replace(
      /Read-Host '[^']+' -AsSecureString/g,
      `ConvertTo-SecureString '${canary}' -AsPlainText -Force`,
    ),
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
      ownedWorkflowId: 'SyntheticOwned',
      passed: true,
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      logCanaryVerified: true,
    }),
  );
  put(
    'scripts/n8n/gw01-reviewed-preview.json',
    JSON.stringify({
      audience: 'https://everyone-market-researcher-synthetic.vercel.app',
      commitSha: 'a'.repeat(40),
      deploymentId: 'dpl_SyntheticOwnedDeployment123',
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
    }),
  );
  put('scripts/seed/certs/supabase-root-2021.crt', 'PUBLIC_SYNTHETIC_CA');
  put('scripts/seed/certs/supabase-root-2021.json', '{}');
  const tls = {
    status: 'verified',
    phase: 'tls_handshake',
    code: 'TLS_VERIFIED',
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    rejectUnauthorized: true,
    exactServerName: true,
    scopedCaVerified: true,
    socketsClosed: true,
    startupMessageSent: false,
    authenticationAttempted: false,
  };
  put(
    'scripts/seed/check-tls.mjs',
    `process.stdout.write(JSON.stringify(${JSON.stringify(mode === 'tlsfailure' ? { ...tls, status: 'failed' } : tls)}));`,
  );
  put(
    'scripts/n8n/gw01-writer.mjs',
    `let text='';for await(const c of process.stdin)text+=c;const input=JSON.parse(text);${mode === 'hang' ? 'setInterval(()=>{},1000);' : `const result={version:1,status:'complete',mode:input.mode,code:null,identity:{currentUser:'n8n_writer',sessionUser:'n8n_writer',database:'postgres',projectRef:'zmotjsbzhzjvpelxvxlf'},authorizationDenials:4,window:{id:'76c2ad42-c094-4ba4-9a0b-566e19b97780',startsAt:null,expiresAt:null,closed:input.mode==='Close',totalAdmitted:0,boundAudience:null,boundCommitSha:null,boundDeploymentId:null},connectionClosed:true};${mode === 'reflection' ? 'result.identity.currentUser=input.password;' : ''}${mode === 'stderr' ? 'process.stderr.write(input.password);' : ''}process.stdout.write(JSON.stringify(result));`}`,
  );
  const paths = [
    'scripts/n8n/gw01-writer.mjs',
    'scripts/n8n/windows/Invoke-M03GW01Writer.ps1',
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    'scripts/n8n/gw01-reviewed-preview.json',
    'scripts/n8n/gw01-local-privacy.json',
    'scripts/n8n/gw01-cloud-privacy.json',
    'scripts/seed/check-tls.mjs',
    'scripts/seed/certs/supabase-root-2021.crt',
    'scripts/seed/certs/supabase-root-2021.json',
  ];
  put(
    'scripts/n8n/gw01-writer-seal.json',
    JSON.stringify({
      version: 1,
      files: Object.fromEntries(
        paths.map((p) => [
          p,
          createHash('sha256')
            .update(readFileSync(join(root, p)))
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
  env.SYNTHETIC_POISON = 'PRIVATE_PARENT_POISON';
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', creator, '-Kind', 'Writer'], {
    env,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(r.status, 0);
  return {
    root,
    local,
    run: (args = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, ...args], {
        env,
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      }),
  };
}
test('writer private subprocess completes boundedcheck thenretains encryptedhandoff for envdelivery/bind/close', () => {
  const f = fixture(),
    r = f.run(['-Mode', 'Verify']);
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.privateRead, true);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.result.authorizationDenials, 4);
  assert.equal(v.handoffRetained, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi')));
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('writer checkonly startsnochild anddoesnotdecrypt', () => {
  const f = fixture(),
    r = f.run(['-CheckOnly']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /CHECK_ONLY_READY/);
});
test('credentialfree TLS failure stops before private read without consumingwriter', () => {
  const f = fixture('tlsfailure'),
    r = f.run();
  assert.equal(r.status, 1);
  const v = JSON.parse(r.stdout);
  assert.equal(v.privateRead, false);
  assert.equal(v.rootChildClosed, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi')));
});
test('writer reflectedvalue is withheld andownedchild closes', () => {
  const f = fixture('reflection'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.result, null);
  assert.equal(v.rootChildClosed, true);
});
test('writer native stderr is discarded ratherthanreported', () => {
  const f = fixture('stderr'),
    r = f.run();
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('writer hungchild is terminated andclosureverified without deleting neededencryptedhandoff', () => {
  const f = fixture('hang'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).rootChildClosed, true);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi')));
});
