import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { inventoryWorkflowNames, inventoryCredentialCandidates } from './inventory.mjs';
import { diagnoseFoundationRuntimeBaselineVariants } from './foundation-runtime-checkpoint.mjs';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots = [];
const osEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
function fixture(mode = 'success') {
  const baselineMode = mode.startsWith('baseline');
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-n8n-fixture-'));
  roots.push(root);
  const put = (path, value) => {
    const file = join(root, path);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, value);
    return file;
  };
  const creator = put(
    'scripts/n8n/windows/New-M03N8nApiHandoff.ps1',
    readFileSync(resolve('scripts/n8n/windows/New-M03N8nApiHandoff.ps1'), 'utf8').replace(
      "Read-Host 'n8n API key for the verified muhhammedsayed instance' -AsSecureString",
      "ConvertTo-SecureString 'synthetic-n8n-key-for-test-only' -AsPlainText -Force",
    ),
  );
  let consumerSource = readFileSync(
    resolve('scripts/n8n/windows/Invoke-M03N8nInventory.ps1'),
    'utf8',
  ).replace('$childTimeoutMs = 75000', '$childTimeoutMs = 500');
  if (mode === 'baselineUnknownClose')
    consumerSource = consumerSource.replace('$closed = $child.WaitForExit(5000)', '$closed = $false');
  if (mode === 'failedStart')
    consumerSource = consumerSource.replace(
      '$node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source',
      "$node = Join-Path $repo 'synthetic-missing-node.exe'",
    );
  const consumer = put('scripts/n8n/windows/Invoke-M03N8nInventory.ps1', consumerSource);
  const result = {
    version: 1,
    environment: 'dev',
    host: 'muhhammedsayed.app.n8n.cloud',
    projectId: 'pHvQjDmjxVZ3KQLT',
    status: 'complete',
    requestCount: 4,
    authenticationVerified: true,
    projectVerified: true,
    diagnostics: {
      version: 1,
      dns: 'complete',
      requests: ['discover', 'projects', 'workflows', 'credentials'].map((resource) => ({
        resource,
        page: 1,
        tcpConnected: true,
        tlsVerified: true,
        httpStatus: 200,
        bodyRead: 'complete',
        jsonParsed: true,
        schemaValidated: true,
        socketClosed: true,
        failureStage: 'none',
        failureCode: 'none',
      })),
    },
    manualExecutionSupportedByReviewedPublicApi: false,
    capabilities: Object.fromEntries(
      [
        'workflowList',
        'workflowRead',
        'workflowCreate',
        'workflowUpdate',
        'workflowPublish',
        'workflowUnpublish',
        'credentialList',
        'credentialRead',
        'credentialTest',
        'projectList',
      ].map((k) => [k, true]),
    ),
    resources: Object.fromEntries(
      ['projects', 'workflows', 'credentials'].map((k) => [
        k,
        { status: 'complete', httpStatus: 200, count: 0, unknownCount: 0, known: [] },
      ]),
    ),
  };
  result.resources.projects = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [{ id: 'pHvQjDmjxVZ3KQLT', type: 'personal' }],
  };
  result.resources.credentials = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [
      Object.fromEntries(
        Object.entries(inventoryCredentialCandidates.find((c) => c.key === 'postgres')).filter(
          ([k]) => k !== 'key',
        ),
      ),
    ],
  };
  result.resources.workflows = {
    status: 'complete',
    httpStatus: 200,
    count: 1,
    unknownCount: 0,
    known: [{ name: 'WF-00 · Orchestrator [dev]', id: 'syntheticWorkflow1', active: false, archived: false }],
  };
  if (mode === 'all25')
    result.resources.workflows = {
      status: 'complete',
      httpStatus: 200,
      count: 25,
      unknownCount: 0,
      known: inventoryWorkflowNames.map((name, i) => ({
        name,
        id: `syntheticWorkflow${i}`,
        active: false,
        archived: false,
      })),
    };
  if (['nativeProviders', 'wrongNativeType', 'wrongCandidateName', 'wrongCandidateId'].includes(mode)) {
    result.resources.credentials = {
      status: 'complete',
      httpStatus: 200,
      count: 5,
      unknownCount: 0,
      known: inventoryCredentialCandidates.map(({ id, name, type }) => ({ id, name, type })),
    };
    const apify = result.resources.credentials.known.find((c) => c.type === 'apifyApi');
    if (mode === 'wrongNativeType') apify.type = 'httpHeaderAuth';
    if (mode === 'wrongCandidateName') apify.name = 'Apify API';
    if (mode === 'wrongCandidateId') apify.id = 'unapprovedSyntheticId';
  }
  if (mode === 'reflectedKey') result.resources.credentials.known[0].id = 'synthetic-n8n-key-for-test-only';
  if (mode === 'unsafeDiagnostics')
    result.diagnostics.requests[2].failureCode = 'synthetic-private-diagnostic-code';
  if (mode === 'workflowBodyFailure') {
    result.status = 'network_failed';
    result.requestCount = 3;
    result.projectVerified = false;
    result.diagnostics.requests = result.diagnostics.requests.slice(0, 3);
    Object.assign(result.diagnostics.requests[2], {
      bodyRead: 'aborted',
      jsonParsed: false,
      schemaValidated: false,
      failureStage: 'body_read',
      failureCode: 'body_aborted',
    });
    result.resources.workflows = {
      status: 'not_attempted',
      httpStatus: null,
      count: 0,
      unknownCount: 0,
      known: [],
    };
    result.resources.credentials = {
      status: 'not_attempted',
      httpStatus: null,
      count: 0,
      unknownCount: 0,
      known: [],
    };
  }
  if (baselineMode) {
    for (const k of Object.keys(result)) delete result[k];
    Object.assign(result, {
      version: 1,
      environment: 'dev',
      host: 'muhhammedsayed.app.n8n.cloud',
      projectId: 'pHvQjDmjxVZ3KQLT',
      status: mode === 'baselineMismatch' ? 'baseline_mismatch' : 'matching_baseline',
      requestCount: 1,
      authenticationVerified: true,
      projectVerified: true,
      workflowKey: 'WF-00',
      baseline: {
        version: 1,
        workflowKey: 'WF-00',
        failedChecks: mode === 'baselineMismatch' ? ['version_mismatch'] : [],
        components: { nameEqual: true, nodesEqual: true, connectionsEqual: true, settingsEqual: true },
      },
      diagnostics: {
        version: 1,
        dns: 'complete',
        requests: [
          {
            resource: 'workflows',
            page: 1,
            tcpConnected: true,
            tlsVerified: true,
            httpStatus: 200,
            bodyRead: 'complete',
            jsonParsed: true,
            schemaValidated: true,
            socketClosed: true,
            failureStage: 'none',
            failureCode: 'none',
          },
        ],
      },
    });
    const record = JSON.parse(readFileSync(resolve('n8n/workflows/WF-00.json'), 'utf8'));
    const baseline = { key: 'WF-00', body: record.workflow };
    result.forensics = structuredClone(diagnoseFoundationRuntimeBaselineVariants(record.workflow, baseline));
    if (mode === 'baselineUnsafe') result.baseline.private = 'synthetic-private-value';
    if (mode === 'baselineUnsafeForensics')
      result.forensics.nodeCategories.parametersEqual = 'synthetic-private-value';
  }
  const code = `import {writeFileSync} from 'node:fs';
 const good=process.env.M03_N8N_API_KEY==='synthetic-n8n-key-for-test-only'&&!process.env.PGPASSWORD&&!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.NODE_OPTIONS${baselineMode ? "&&process.argv.length===3&&process.argv[2]==='--workflow-baseline-diagnostic'" : ''};
 writeFileSync(new URL('./called.txt',import.meta.url),good?'only-n8n-key':'wrong-env');
 delete process.env.M03_N8N_API_KEY;
 console.error('synthetic-private-stderr-must-stay-hidden');
 ${['timeout', 'baselineTimeout', 'baselineUnknownClose'].includes(mode) ? 'await new Promise(r=>setTimeout(r,10000));' : ''}
 console.log(${mode === 'badJson' ? "'synthetic-private-stdout-must-stay-hidden'" : mode === 'unsafeSchema' ? JSON.stringify(JSON.stringify({ ...result, privateSecret: 'synthetic-private-value' })) : JSON.stringify(JSON.stringify(result))});
 ${mode === 'failure' ? 'process.exitCode=7;' : mode === 'workflowBodyFailure' ? 'process.exitCode=1;' : ''}`;
  put('scripts/n8n/inventory.mjs', code);
  const paths = [
    'scripts/n8n/windows/New-M03N8nApiHandoff.ps1',
    'scripts/n8n/windows/Invoke-M03N8nInventory.ps1',
    'scripts/n8n/inventory.mjs',
  ];
  const seal = {
    version: 1,
    host: 'muhhammedsayed.app.n8n.cloud',
    projectId: 'pHvQjDmjxVZ3KQLT',
    files: Object.fromEntries(
      paths.map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(join(root, p)))
          .digest('hex'),
      ]),
    ),
  };
  if (baselineMode) {
    const baselineFiles = [
      'scripts/n8n/foundation-runtime-checkpoint.mjs',
      'n8n/workflows/WF-00.json',
      'scripts/n8n/windows/Dev-CredentialStore.ps1',
    ];
    for (const path of baselineFiles) put(path, readFileSync(resolve(path)));
    seal.baselineFiles = Object.fromEntries(
      baselineFiles.map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(join(root, p)))
          .digest('hex'),
      ]),
    );
  }
  put('scripts/n8n/m03-inventory-seal.json', JSON.stringify(seal));
  mkdirSync(join(root, 'private/Temp'), { recursive: true });
  const runFile = (file, args = []) =>
    spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', file, ...args], {
      env: {
        ...osEnv(),
        LOCALAPPDATA: join(root, 'private'),
        PGPASSWORD: 'unrelated-db-secret',
        SUPABASE_ACCESS_TOKEN: 'unrelated-api-secret',
        NODE_OPTIONS: '--no-warnings',
      },
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
  assert.equal(runFile(creator).status, 0);
  if (baselineMode) {
    const initialize = put(
      'synthetic-initialize.ps1',
      String.raw`
. (Join-Path $PSScriptRoot 'scripts/n8n/windows/Dev-CredentialStore.ps1')
$null=Initialize-M03DevPrivateDirectory
$spec=Get-M03DevCredentialSpec Management
$bytes=[IO.File]::ReadAllBytes((Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-n8n-api-key.dpapi'))
Write-M03DevPrivateFile $spec.Source $bytes
$store=Join-Path (Get-M03DevCredentialRoot) 'store.operation.lock'
$s=[IO.File]::Open($store,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$s.Dispose();Set-M03DevPrivateAcl $store $false
[IO.File]::Delete((Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-n8n-api-key.dpapi'))
`,
    );
    assert.equal(runFile(initialize).status, 0);
  }
  return {
    root,
    put,
    creator,
    consumer,
    handoff: join(root, 'private/Temp/emr-m03-n8n-api-key.dpapi'),
    run: (check = false) =>
      runFile(consumer, [
        ...(check ? ['-CheckOnly'] : []),
        ...(baselineMode ? ['-WorkflowBaselineDiagnostic'] : []),
      ]),
  };
}
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
describe(
  'M03 n8n bounded private inventory consumer, isolated synthetic Windows DPAPI only',
  { skip: process.platform !== 'win32' },
  () => {
    it('baseline CheckOnly validates public sources without materializing persistent credentials or a coordinator lock', () => {
      const f = fixture('baselineSuccess'),
        r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /BASELINE_CHECK_ONLY_READY/);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    for (const mode of [
      'baselineSuccess',
      'baselineMismatch',
      'baselineUnsafe',
      'baselineTimeout',
      'baselineUnsafeForensics',
    ])
      it(`baseline one-GET consumer ${mode} uses only persistent Management and removes disposable state`, () => {
        const f = fixture(mode),
          persistent = join(
            f.root,
            'private/Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi',
          ),
          before = readFileSync(persistent),
          r = f.run();
        assert.equal(
          r.status,
          ['baselineSuccess', 'baselineMismatch'].includes(mode) ? 0 : 1,
          r.stdout + r.stderr,
        );
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.equal(existsSync(f.handoff), false);
        assert.equal(
          existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')),
          false,
        );
        assert.deepEqual(readFileSync(persistent), before);
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
        if (mode === 'baselineMismatch')
          assert.deepEqual(receipt.inventory.baseline.failedChecks, ['version_mismatch']);
        if (mode === 'baselineUnsafe' || mode === 'baselineTimeout' || mode === 'baselineUnsafeForensics')
          assert.equal(receipt.inventory, null);
      });
    it('baseline diagnostic refuses an existing acceptance mutex before materialization or a native child', () => {
      const f = fixture('baselineSuccess');
      const mutex = join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock');
      writeFileSync(mutex, 'synthetic-foreign-operation');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(readFileSync(mutex, 'utf8'), 'synthetic-foreign-operation');
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('unknown native closure retains disposable ciphertext and shared mutex rather than allowing overlapping admission', () => {
      const f = fixture('baselineUnknownClose'),
        r = f.run();
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.childClosed, false);
      assert.equal(receipt.handoffDeleted, false);
      assert.equal(existsSync(f.handoff), true);
      assert.equal(existsSync(join(f.root, 'private/Temp/emr-m03-acceptance-parent.operation.lock')), true);
      const again = f.run();
      assert.equal(again.status, 1);
      assert.match(again.stdout, /HANDOFF_PATH_BLOCKED/);
      assert.doesNotMatch(
        r.stdout + r.stderr + again.stdout + again.stderr,
        /synthetic-private|unrelated-|synthetic-n8n-key/,
      );
    });
    it('checks fixed public seals and presence without decrypting or launching inventory', () => {
      const f = fixture();
      const r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /CHECK_ONLY_READY/);
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
      assert.ok(existsSync(f.handoff));
    });
    it('does not overwrite an existing new handoff', () => {
      const f = fixture();
      const before = readFileSync(f.handoff);
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', f.creator], {
        env: { ...osEnv(), LOCALAPPDATA: join(f.root, 'private') },
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(r.status, 1);
      assert.deepEqual(readFileSync(f.handoff), before);
    });
    it('rejects a changed source before private read', () => {
      const f = fixture();
      f.put('scripts/n8n/inventory.mjs', 'modified');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.ok(existsSync(f.handoff));
      assert.equal(existsSync(join(f.root, 'scripts/n8n/called.txt')), false);
    });
    it('gives the child only its key, suppresses stderr, validates safe JSON and deletes consumed DPAPI', () => {
      const f = fixture();
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(readFileSync(join(f.root, 'scripts/n8n/called.txt'), 'utf8'), 'only-n8n-key');
      assert.equal(existsSync(f.handoff), false);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.inventory.status, 'complete');
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|unrelated-|synthetic-n8n-key/);
    });
    it('accepts all25 exact canonical names through the actual Windows parser', () => {
      const f = fixture('all25');
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(JSON.parse(r.stdout).inventory.resources.workflows.known.length, 25);
    });
    it('preserves safe completed auth/project stages and a bounded workflow body-failure diagnostic', () => {
      const f = fixture('workflowBodyFailure');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = JSON.parse(r.stdout.trim());
      assert.equal(receipt.status, 'inventory_failed');
      assert.equal(receipt.inventory.authenticationVerified, true);
      assert.equal(receipt.inventory.resources.projects.httpStatus, 200);
      assert.equal(receipt.inventory.diagnostics.requests[2].failureCode, 'body_aborted');
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
    });
    it('rejects non-allowlisted diagnostic text without exposing it and still deletes consumed credentials', () => {
      const f = fixture('unsafeDiagnostics');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = JSON.parse(r.stdout.trim());
      assert.equal(receipt.inventory, null);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private/);
    });
    it('accepts allfive exact authorized credential ID/name/type triples including native Apify and OpenAI', () => {
      const f = fixture('nativeProviders'),
        r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.inventory.resources.credentials.known.length, 5);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffDeleted, true);
    });
    for (const mode of [
      'badJson',
      'unsafeSchema',
      'failure',
      'timeout',
      'reflectedKey',
      'failedStart',
      'wrongNativeType',
      'wrongCandidateName',
      'wrongCandidateId',
    ])
      it(`suppresses ${mode} child output, closes it and cleans consumed credentials`, () => {
        const f = fixture(mode);
        const r = f.run();
        assert.equal(r.status, 1);
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private|synthetic-n8n-key|unrelated-/);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.handoffDeleted, true);
        assert.equal(receipt.inventory, null);
        assert.equal(existsSync(f.handoff), false);
      });
  },
);
