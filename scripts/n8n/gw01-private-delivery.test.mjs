import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  roots = [],
  canary = 'SYNTHETIC_PRIVATE_GW01_MANAGEMENT_CANARY';
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
function fixture(mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-private-fixture-'));
  roots.push(root);
  const put = (name, body) => {
    const p = join(root, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
    return p;
  };
  const consumer = put(
    'scripts/n8n/windows/Invoke-M03GW01Delivery.ps1',
    readFileSync('scripts/n8n/windows/Invoke-M03GW01Delivery.ps1', 'utf8').replace(
      'WaitForExit(90000)',
      'WaitForExit(1000)',
    ),
  );
  const creator = put(
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    readFileSync('scripts/n8n/windows/New-M03GW01Handoff.ps1', 'utf8').replace(
      /Read-Host '[^']+' -AsSecureString/g,
      `ConvertTo-SecureString '${canary}' -AsPlainText -Force`,
    ),
  );
  put('scripts/n8n/inventory.mjs', '// Synthetic public transport fixture only.');
  put('scripts/n8n/gw01-delivery-transport.mjs', '// Synthetic public transport fixture only.');
  put('scripts/n8n/gw01-credential-ownership.mjs', '// Synthetic public provenance fixture only.');
  put('scripts/n8n/gw01-privacy-read.mjs', '// Synthetic public privacy fixture only.');
  put(
    'scripts/n8n/gw01-delivery-packet.json',
    JSON.stringify({
      version: 1,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
      audience: 'https://everyone-market-researcher-synthetic.vercel.app',
      commitSha: 'a'.repeat(40),
      deploymentId: 'dpl_SyntheticOwnedDeployment123',
    }),
  );
  put(
    'scripts/n8n/gw01-local-privacy.json',
    JSON.stringify({ version: 1, passed: true, consumerReviewed: true, canaryTestsPassed: true }),
  );
  put(
    'scripts/n8n/gw01-delivery.mjs',
    `let text='';for await(const c of process.stdin)text+=c;const input=JSON.parse(text);${mode === 'hang' ? 'setInterval(()=>{},1000);' : `let result={version:1,status:'complete',mode:input.mode,managementRequests:3,credential:{id:${mode === 'reflection' ? 'input.secrets.management' : "'EmrGw01Canary18'"},name:'M03 GW-01 privacy canary [dev]',type:'httpCustomAuth',createdAt:'2026-10-18T12:00:00.000Z'},branch:'m03-n8n-foundation',previewOnly:true};${mode === 'stderr' ? 'process.stderr.write(input.secrets.management);' : ''}${mode === 'diagnostic' ? "result={version:1,status:'stopped_reconcile',privateDetailsWithheld:true,code:'GW01_TRANSPORT_BODY'};process.exitCode=1;" : ''}${mode === 'reconcile' ? "result={version:1,status:'complete',mode:input.mode,managementRequests:1,exists:true,ownershipVerified:false,credential:result.credential,projectReadbackVerified:false,automaticPostRetry:false};" : ''}process.stdout.write(JSON.stringify(result));`}`,
  );
  const paths = [
    'scripts/n8n/gw01-delivery.mjs',
    'scripts/n8n/gw01-delivery-transport.mjs',
    'scripts/n8n/gw01-credential-ownership.mjs',
    'scripts/n8n/gw01-privacy-read.mjs',
    'scripts/n8n/inventory.mjs',
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    'scripts/n8n/windows/Invoke-M03GW01Delivery.ps1',
    'scripts/n8n/gw01-delivery-packet.json',
    'scripts/n8n/gw01-local-privacy.json',
  ];
  const seal = {
    version: 1,
    files: Object.fromEntries(
      paths.map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(join(root, p)))
          .digest('hex'),
      ]),
    ),
    vercelCliSha256: '0'.repeat(64),
    vercelPackageSha256: '0'.repeat(64),
  };
  put('scripts/n8n/gw01-delivery-seal.json', JSON.stringify(seal));
  const local = join(root, 'private');
  mkdirSync(join(local, 'Temp'), { recursive: true });
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  env.LOCALAPPDATA = local;
  env.SYNTHETIC_POISON = 'SYNTHETIC_ENV_CANARY_MUST_NOT_INHERIT';
  const saved = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', creator, '-Kind', 'Management'], {
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
    env,
    run: (extra = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, ...extra], {
        env,
        encoding: 'utf8',
        timeout: 20000,
        windowsHide: true,
      }),
  };
}
test('bounded synthetic private consumer decrypts only in child phase, printsmetadataonly and retainsencryptedmanagementbetweenphases', () => {
  const f = fixture(),
    r = f.run();
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.privateRead, true);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.delivery.credential.id, 'EmrGw01Canary18');
  assert.equal(v.handoffsRetained, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
});
test('check-only neverdecrypts or startsprivatechild', () => {
  const f = fixture(),
    r = f.run(['-CheckOnly']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /CHECK_ONLY_READY/);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('reflected secret is withheld, childclosed and failed-phasehandoffsdeleted', () => {
  const f = fixture('reflection'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.delivery, null);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, false);
});
test('raw privatestderr isdiscarded ratherthanreturned asdiagnostic', () => {
  const f = fixture('stderr'),
    r = f.run();
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('timeoutkillsownedchildandcleanstemporaryprivatehandoff', () => {
  const f = fixture('hang'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, false);
});
test('expired management deliverylease blocksbeforedecryption', () => {
  const f = fixture();
  writeFileSync(
    join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json'),
    JSON.stringify({
      version: 1,
      windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-01-01T02:00:00Z',
    }),
  );
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PREFLIGHT_BLOCKED/);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
});
test('changed source seal blocks before private file read withoutconsumingkey', () => {
  const f = fixture();
  writeFileSync(join(f.root, 'scripts/n8n/gw01-delivery.mjs'), 'throw Error("syntheticchangedsource");');
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PREFLIGHT_BLOCKED/);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
});
test('finite transport failure retains same encrypted Management lease for GET-only reconciliation', () => {
  const f = fixture('diagnostic'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.code, 'GW01_TRANSPORT_BODY');
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
});
test('GET-only reconciliation validates safe metadata without claiming project or secret readback', () => {
  const f = fixture('reconcile'),
    r = f.run(['-Mode', 'ReconcileCanary']);
  assert.equal(r.status, 0);
  const v = JSON.parse(r.stdout);
  assert.equal(v.delivery.ownershipVerified, false);
  assert.equal(v.delivery.projectReadbackVerified, false);
  assert.equal(v.delivery.automaticPostRetry, false);
  assert.equal(v.handoffsRetained, true);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
