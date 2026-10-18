import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { writerPreview } from './gw01-writer.mjs';
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
      version: 1,
      audience: 'https://everyone-market-researcher-synthetic.vercel.app',
      commitSha: 'a'.repeat(40),
      deploymentId: 'dpl_SyntheticOwnedDeployment123',
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
      branch: 'm03-n8n-foundation',
      target: 'preview',
      protection: 'all_except_custom_domains',
      routeDisabledVerified: false,
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
    `import {writeFileSync} from 'node:fs';writeFileSync('synthetic-tls-started.json','true');process.stdout.write(JSON.stringify(${JSON.stringify(mode === 'tlsfailure' ? { ...tls, status: 'failed' } : tls)}));`,
  );
  put(
    'scripts/n8n/gw01-writer.mjs',
    `import {writeFileSync} from 'node:fs';let text='';for await(const c of process.stdin)text+=c;const input=JSON.parse(text);writeFileSync('synthetic-writer-preview.json',JSON.stringify(input.preview));${mode === 'hang' ? 'setInterval(()=>{},1000);' : `const result={version:1,status:'complete',mode:input.mode,code:null,identity:{currentUser:'n8n_writer',sessionUser:'n8n_writer',database:'postgres',projectRef:'zmotjsbzhzjvpelxvxlf'},authorizationDenials:4,window:{id:'76c2ad42-c094-4ba4-9a0b-566e19b97780',startsAt:null,expiresAt:null,closed:input.mode==='Close',totalAdmitted:0,boundAudience:null,boundCommitSha:null,boundDeploymentId:null},connectionClosed:true};${mode === 'reflection' ? 'result.identity.currentUser=input.password;' : ''}${mode === 'stderr' ? 'process.stderr.write(input.password);' : ''}process.stdout.write(JSON.stringify(result));`}`,
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
    mutatePreview(change) {
      const relative = 'scripts/n8n/gw01-reviewed-preview.json',
        file = join(root, relative),
        preview = JSON.parse(readFileSync(file, 'utf8'));
      change(preview);
      writeFileSync(file, JSON.stringify(preview));
      const sealFile = join(root, 'scripts/n8n/gw01-writer-seal.json'),
        seal = JSON.parse(readFileSync(sealFile, 'utf8'));
      seal.files[relative] = createHash('sha256').update(readFileSync(file)).digest('hex');
      writeFileSync(sealFile, JSON.stringify(seal));
    },
    run: (args = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, ...args], {
        env,
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      }),
  };
}
test('writer accepts shared ten-field manifest and sends the exact five-field JavaScript contract', () => {
  const f = fixture(),
    r = f.run(['-Mode', 'Inspect']);
  assert.equal(r.status, 0, r.stdout);
  const preview = JSON.parse(readFileSync(join(f.root, 'synthetic-writer-preview.json'), 'utf8'));
  assert.deepEqual(Object.keys(preview).sort(), [
    'audience',
    'branch',
    'commitSha',
    'deploymentId',
    'projectId',
  ]);
  assert.deepEqual(writerPreview(preview), preview);
  assert.equal(JSON.parse(r.stdout).rootChildClosed, true);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});

for (const [label, change] of [
  [
    'unknown field',
    (p) => {
      p.unapproved = true;
    },
  ],
  [
    'missing field',
    (p) => {
      delete p.teamId;
    },
  ],
  [
    'wrong-case key',
    (p) => {
      p.Version = p.version;
      delete p.version;
    },
  ],
  [
    'version string',
    (p) => {
      p.version = '1';
    },
  ],
  [
    'version boolean',
    (p) => {
      p.version = true;
    },
  ],
  [
    'route flag string',
    (p) => {
      p.routeDisabledVerified = 'false';
    },
  ],
  [
    'wrong team',
    (p) => {
      p.teamId = 'team_Unapproved';
    },
  ],
  [
    'production target',
    (p) => {
      p.target = 'production';
    },
  ],
  [
    'different protection',
    (p) => {
      p.protection = 'none';
    },
  ],
])
  test('writer rejects ten-field manifest ' + label + ' before TLS or private consumption', () => {
    const f = fixture();
    f.mutatePreview(change);
    const r = f.run();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /GW01_WRITER_PREFLIGHT_BLOCKED/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
    assert.equal(existsSync(join(f.root, 'synthetic-tls-started.json')), false);
    assert.equal(existsSync(join(f.root, 'synthetic-writer-preview.json')), false);
    assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi')));
  });

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
