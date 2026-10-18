import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { inventoryWorkflowNames } from './inventory.mjs';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots = [];
const osEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
function fixture(mode = 'success') {
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
    known: [{ name: 'Supabase Postgres · n8n_writer · dev', id: 'syntheticCredential1', type: 'postgres' }],
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
  if (mode === 'reflectedKey') result.resources.credentials.known[0].id = 'synthetic-n8n-key-for-test-only';
  const code = `import {writeFileSync} from 'node:fs';
 const good=process.env.M03_N8N_API_KEY==='synthetic-n8n-key-for-test-only'&&!process.env.PGPASSWORD&&!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.NODE_OPTIONS;
 writeFileSync(new URL('./called.txt',import.meta.url),good?'only-n8n-key':'wrong-env');
 delete process.env.M03_N8N_API_KEY;
 console.error('synthetic-private-stderr-must-stay-hidden');
 ${mode === 'timeout' ? 'await new Promise(r=>setTimeout(r,10000));' : ''}
 console.log(${mode === 'badJson' ? "'synthetic-private-stdout-must-stay-hidden'" : mode === 'unsafeSchema' ? JSON.stringify(JSON.stringify({ ...result, privateSecret: 'synthetic-private-value' })) : JSON.stringify(JSON.stringify(result))});
 ${mode === 'failure' ? 'process.exitCode=7;' : ''}`;
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
  return {
    root,
    put,
    creator,
    consumer,
    handoff: join(root, 'private/Temp/emr-m03-n8n-api-key.dpapi'),
    run: (check = false) => runFile(consumer, check ? ['-CheckOnly'] : []),
  };
}
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
describe(
  'M03 n8n bounded private inventory consumer, isolated synthetic Windows DPAPI only',
  { skip: process.platform !== 'win32' },
  () => {
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
    for (const mode of ['badJson', 'unsafeSchema', 'failure', 'timeout', 'reflectedKey', 'failedStart'])
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
