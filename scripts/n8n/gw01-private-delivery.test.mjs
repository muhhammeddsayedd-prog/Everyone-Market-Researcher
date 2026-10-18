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
function fixture(mode = 'success', phase = 'Canary') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-private-fixture-'));
  roots.push(root);
  const put = (name, body) => {
    const p = join(root, name);
    mkdirSync(dirname(p), { recursive: true });
    let content = body;
    if (name === 'scripts/n8n/gw01-delivery.mjs') {
      content = content
        .replace(
          'executionCanaryVerified:true,privateDetailsWithheld:true',
          'executionCanaryVerified:true,httpStatusCode:401,privateDetailsWithheld:true',
        )
        .replace(
          'privateDetailsWithheld:true,code:',
          'privateDetailsWithheld:true,privacyStage:null,privacyParameterDiagnostic:null,code:',
        );
      const stages = {
        stage_contract: 'executed_snapshot_workflow_id',
        stage_task: 'native_http_task',
        stage_current_reflection: 'current_workflow_canary_reflection',
        stage_execution_reflection: 'execution_canary_reflection',
        stage_management_reflection: 'management_reflection',
        stage_unknown: 'unknown_dynamic_stage',
        stage_private: canary,
        stage_noop_cleanup: 'execution_canary_reflection',
        stage_parameters: 'executed_snapshot_parameters',
        stage_parameter_private: 'executed_snapshot_parameters',
        stage_parameter_shape: 'executed_snapshot_parameters',
        stage_parameter_native_unknown: 'executed_snapshot_parameters',
        stage_parameter_native_bool: 'executed_snapshot_parameters',
      };
      const diagnostic = mode.startsWith('stage_parameter')
        ? {
            paths: [mode === 'stage_parameter_private' ? canary : 'jsonBody', 'parameters_other'],
            jsonBodyTextDifferent: mode === 'stage_parameter_shape' ? canary : true,
            jsonBodySemanticEqual: true,
            nativeSchema: ['manual', 'http', 'receipt'].map((node) => ({
              node,
              identityMatched: true,
              differences: [],
              unclassifiedDifference: false,
            })),
          }
        : null;
      if (diagnostic)
        diagnostic.nativeSchema[0].differences.push({
          path: mode === 'stage_parameter_native_unknown' ? 'unsupported_native_path' : 'notice',
          currentPresent: false,
          executedPresent: true,
          currentDefaultEqual: mode === 'stage_parameter_native_bool' ? false : null,
          executedDefaultEqual: true,
        });
      if (Object.hasOwn(stages, mode))
        content = content.replace(
          'process.stdout.write(JSON.stringify(result));',
          `result={version:1,status:'stopped_reconcile',privateDetailsWithheld:true,code:'GW01_DELIVERY_RESPONSE_REJECTED',privacyStage:${JSON.stringify(stages[mode])},privacyParameterDiagnostic:${JSON.stringify(diagnostic)}};process.exitCode=1;process.stdout.write(JSON.stringify(result));`,
        );
      if (phase === 'Cleanup')
        content = content.replace(
          'process.stdout.write(JSON.stringify(result));',
          "result={version:1,status:'complete',mode:input.mode,managementRequests:0,deletedCredentialIds:[]};process.stdout.write(JSON.stringify(result));",
        );
    }
    writeFileSync(p, content);
    return p;
  };
  const consumer = put(
    'scripts/n8n/windows/Invoke-M03GW01Delivery.ps1',
    readFileSync('scripts/n8n/windows/Invoke-M03GW01Delivery.ps1', 'utf8')
      .replace('$childTimeoutMs=90000', '$childTimeoutMs=1000')
      .replace(
        "$ErrorActionPreference='Stop'",
        "$ErrorActionPreference='Stop'" +
          (['stage_noop_cleanup', 'cleanup_noop'].includes(mode)
            ? '\nfunction Remove-Item { param([string]$LiteralPath,[string]$ErrorAction) }'
            : ''),
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
    'scripts/n8n/gw01-delivery.mjs',
    `let text='';for await(const c of process.stdin)text+=c;const input=JSON.parse(text);${mode === 'hang' ? 'setInterval(()=>{},1000);' : `let result={version:1,status:'complete',mode:input.mode,managementRequests:3,credential:{id:${mode === 'reflection' ? 'input.secrets.management' : "input.mode==='RuntimeCredential'?'EmrGw01Machine18':'EmrGw01Canary18'"},name:input.mode==='RuntimeCredential'?'M03 GW-01 machine [dev]':'M03 GW-01 privacy canary [dev]',type:'httpCustomAuth',createdAt:'2026-10-18T12:00:00.000Z'},branch:'m03-n8n-foundation',previewOnly:true};${mode === 'stderr' ? 'process.stderr.write(input.secrets.management);' : ''}${mode === 'diagnostic' ? "result={version:1,status:'stopped_reconcile',privateDetailsWithheld:true,code:'GW01_TRANSPORT_BODY'};process.exitCode=1;" : ''}${mode === 'reconcile' ? "result={version:1,status:'complete',mode:input.mode,managementRequests:1,exists:true,ownershipVerified:false,credential:result.credential,projectReadbackVerified:false,automaticPostRetry:false};" : ''}${phase === 'Environment' ? "if(Object.keys(input.secrets).sort().join(',')!=='machine,writer')process.exit(1);result={version:1,status:'complete',mode:input.mode,managementRequests:0,vercelCommands:2,branch:'m03-n8n-foundation',previewOnly:true};" : ''}${phase === 'RuntimeCredential' ? "if(Object.keys(input.secrets).sort().join(',')!=='machine,management,protection')process.exit(1);" : ''}${phase === 'PrivacyReadRetainedCanary' ? "result={version:1,status:'complete',mode:input.mode,managementRequests:2,privacy:{version:1,status:'complete',workflowId:'SyntheticOwned',executionId:'123',exportCanaryVerified:true,executionCanaryVerified:true,privateDetailsWithheld:true}};" : ''}process.stdout.write(JSON.stringify(result));`}`,
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
  if (['Environment', 'RuntimeCredential'].includes(phase)) paths.push('scripts/n8n/gw01-cloud-privacy.json');
  if (phase === 'PrivacyReadRetainedCanary') {
    put(
      'scripts/n8n/gw01-owned-privacy-target.json',
      JSON.stringify({
        workflowId: 'SyntheticOwned',
        executionId: '123',
        audience: 'https://everyone-market-researcher-synthetic.vercel.app',
      }),
    );
    paths.push('scripts/n8n/gw01-owned-privacy-target.json');
  }
  const fakeCli = put('appdata/npm/node_modules/vercel/dist/vc.js', '// No actualVercelinvocation.'),
    fakePkg = put('appdata/npm/node_modules/vercel/package.json', JSON.stringify({ version: '56.5.0' }));
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
    vercelCliSha256: createHash('sha256').update(readFileSync(fakeCli)).digest('hex'),
    vercelPackageSha256: createHash('sha256').update(readFileSync(fakePkg)).digest('hex'),
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
  env.APPDATA = join(root, 'appdata');
  env.SYNTHETIC_POISON = 'SYNTHETIC_ENV_CANARY_MUST_NOT_INHERIT';
  const saved = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', creator, '-Kind', 'Management'], {
    env,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(saved.status, 0);
  if (['Environment', 'RuntimeCredential'].includes(phase)) {
    for (const kind of phase === 'Environment' ? ['Writer', 'Machine'] : ['Machine', 'ProtectionBypass']) {
      const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', creator, '-Kind', kind], {
        env,
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
    }
  }
  return {
    root,
    local,
    consumer,
    env,
    run: (extra = []) =>
      spawnSync(
        ps,
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          consumer,
          ...(phase === 'Canary' ? [] : ['-Mode', phase]),
          ...extra,
        ],
        {
          env,
          encoding: 'utf8',
          timeout: 20000,
          windowsHide: true,
        },
      ),
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
test('Environment decrypts only writer/machine and needs no Management handoff or lease', () => {
  const f = fixture('success', 'Environment');
  rmSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi'));
  rmSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json'));
  const r = f.run();
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.delivery.vercelCommands, 2);
  assert.equal(v.delivery.managementRequests, 0);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('RuntimeCredential excludes writer/admin and leaves unused writer file intact', () => {
  const f = fixture('success', 'RuntimeCredential');
  writeFileSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi'), 'UNREAD_SYNTHETIC_INVALID_DPAPI');
  const r = f.run();
  assert.equal(r.status, 0, r.stdout);
  assert.equal(JSON.parse(r.stdout).delivery.credential.id, 'EmrGw01Machine18');
  assert.equal(
    readFileSync(join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi'), 'utf8'),
    'UNREAD_SYNTHETIC_INVALID_DPAPI',
  );
});
test('explicit retainedFAKE mode usesonlyManagement and validatesfixedprivacyprojection', () => {
  const f = fixture('success', 'PrivacyReadRetainedCanary'),
    r = f.run();
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.delivery.privacy.executionCanaryVerified, true);
  assert.equal(v.delivery.privacy.workflowId, 'SyntheticOwned');
  assert.equal(v.delivery.privacy.httpStatusCode, 401);
});
test('near-expiry Management lease stops before decrypting rather than overrunning lifetime', () => {
  const f = fixture(),
    expires = new Date(Date.now() + 5000);
  writeFileSync(
    join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json'),
    JSON.stringify({
      version: 1,
      windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
      createdAt: new Date(expires.getTime() - 7200000).toISOString(),
      expiresAt: expires.toISOString(),
    }),
  );
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PREFLIGHT_BLOCKED/);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
});
test('failed RuntimeCredential cleans only consumedinputs and preserves unreadwriter for Close', () => {
  const f = fixture('reflection', 'RuntimeCredential'),
    writer = join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi');
  writeFileSync(writer, 'UNREAD_SYNTHETIC_INVALID_DPAPI');
  const r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  assert.equal(readFileSync(writer, 'utf8'), 'UNREAD_SYNTHETIC_INVALID_DPAPI');
  for (const name of ['management', 'machine', 'protection'])
    assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-' + name + '.dpapi')), false);
});
for (const kind of ['stage_contract', 'stage_task'])
  test(
    'finite non-reflection privacy contract failure retains only encrypted Management for read-only reconciliation: ' +
      kind,
    () => {
      const f = fixture(kind, 'PrivacyReadRetainedCanary'),
        writer = join(f.local, 'Temp/emr-m03-gw01-dev-writer.dpapi');
      writeFileSync(writer, 'UNREAD_SYNTHETIC_WRITER');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
      const v = JSON.parse(r.stdout);
      assert.equal(v.code, 'GW01_DELIVERY_RESPONSE_REJECTED');
      assert.equal(
        v.privacyStage,
        kind === 'stage_contract' ? 'executed_snapshot_workflow_id' : 'native_http_task',
      );
      assert.equal(v.rootChildClosed, true);
      assert.equal(v.handoffsRetained, true);
      assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
      assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json')));
      assert.equal(readFileSync(writer, 'utf8'), 'UNREAD_SYNTHETIC_WRITER');
    },
  );
for (const kind of [
  'stage_current_reflection',
  'stage_execution_reflection',
  'stage_management_reflection',
  'stage_unknown',
  'stage_private',
])
  test(
    'unsafe/unknown privacy diagnostic deletes consumed Management and never echoes dynamic data: ' + kind,
    () => {
      const f = fixture(kind, 'PrivacyReadRetainedCanary'),
        r = f.run();
      assert.equal(r.status, 1);
      assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
      const v = JSON.parse(r.stdout);
      assert.equal(v.rootChildClosed, true);
      assert.equal(v.handoffsRetained, false, JSON.stringify(v));
      assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')), false);
      assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json')), false);
      if (kind === 'stage_unknown' || kind === 'stage_private') assert.equal(v.privacyStage, null);
    },
  );

test('a native no-op deletion cannot produce a deleted-handoff receipt', () => {
  const f = fixture('stage_noop_cleanup', 'PrivacyReadRetainedCanary'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json')));
});

test('successful remote Cleanup with unverified local deletion cannot report complete', () => {
  const f = fixture('cleanup_noop', 'Cleanup'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.rootChildClosed, true);
  assert.equal(v.handoffsRetained, true);
  assert.equal(v.status, 'stopped_reconcile');
  assert.equal(v.code, 'GW01_CHILD_CLEANUP_UNVERIFIED');
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')));
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json')));
});

test('only fixed parameter paths and boolean diagnostics can be retained for one read-only reconciliation', () => {
  const f = fixture('stage_parameters', 'PrivacyReadRetainedCanary'),
    r = f.run();
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
  const v = JSON.parse(r.stdout);
  assert.equal(v.privacyStage, 'executed_snapshot_parameters');
  const { nativeSchema, ...known } = v.privacyParameterDiagnostic;
  assert.equal(nativeSchema.length, 3);
  assert.deepEqual(nativeSchema[0].differences, [
    {
      path: 'notice',
      currentPresent: false,
      executedPresent: true,
      currentDefaultEqual: null,
      executedDefaultEqual: true,
    },
  ]);
  assert.deepEqual(known, {
    paths: ['jsonBody', 'parameters_other'],
    jsonBodyTextDifferent: true,
    jsonBodySemanticEqual: true,
  });
  assert.equal(v.handoffsRetained, true);
});
for (const mode of [
  'stage_parameter_private',
  'stage_parameter_shape',
  'stage_parameter_native_unknown',
  'stage_parameter_native_bool',
])
  test('unsafe parameter diagnostic is withheld and consumed Management is deleted: ' + mode, () => {
    const f = fixture(mode, 'PrivacyReadRetainedCanary'),
      r = f.run();
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
    const v = JSON.parse(r.stdout);
    assert.equal(v.privacyParameterDiagnostic, null);
    assert.equal(v.handoffsRetained, false);
    assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.dpapi')), false);
    assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-management.lease.json')), false);
  });
