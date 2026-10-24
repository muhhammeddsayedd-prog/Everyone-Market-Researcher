import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { previewArguments, runPreviewRead, nativePreviewGet, previewFailure } from './gw01-preview-read.mjs';

const packet = {
  version: 1,
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  branch: 'm03-n8n-foundation',
  sourceSha: 'a'.repeat(40),
};
const id = 'dpl_SyntheticPreview123456789';
const host = 'everyone-market-researcher-synthetic.vercel.app';
const createdAt = 1792313743000;
function fixture() {
  const project = {
    id: packet.projectId,
    accountId: packet.teamId,
    autoExposeSystemEnvs: true,
    framework: 'nextjs',
    rootDirectory: 'apps/web',
    ssoProtection: { deploymentType: 'all_except_custom_domains' },
  };
  const row = {
    uid: id,
    url: host,
    projectId: packet.projectId,
    readyState: 'READY',
    target: null,
    createdAt,
    meta: { githubCommitSha: packet.sourceSha, githubCommitRef: packet.branch },
    projectSettings: { framework: 'nextjs', rootDirectory: 'apps/web' },
  };
  const deployment = {
    id,
    url: host,
    projectId: packet.projectId,
    ownerId: packet.teamId,
    team: { id: packet.teamId },
    readyState: 'READY',
    target: null,
    createdAt,
    meta: row.meta,
    gitSource: { type: 'github', ref: packet.branch, sha: packet.sourceSha },
    projectSettings: { framework: 'nextjs' },
  };
  const list = { deployments: [row], pagination: { count: 1, next: null, prev: null } };
  const calls = [];
  const get = async (kind, selectedId) => {
    calls.push({ kind, selectedId });
    return { project, list, deployment }[kind];
  };
  return { project, row, deployment, list, get, calls };
}
test('Preview read uses fixed GET project/list/one selected deployment and projects only nonsecret metadata', async () => {
  const f = fixture();
  for (const target of [f.project, f.deployment])
    for (const key of ['env', 'build', 'protectionBypass', 'secrets'])
      Object.defineProperty(target, key, {
        get() {
          throw Error('PRIVATE_GETTER');
        },
      });
  const r = await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
  assert.equal(r.status, 'verified');
  assert.equal(r.target.commitSha, packet.sourceSha);
  assert.equal(r.target.audience, 'https://' + host);
  assert.equal(r.autoExposeSystemEnvs, true);
  assert.equal(r.privateFieldsProjected, false);
  assert.deepEqual(f.calls, [
    { kind: 'project', selectedId: undefined },
    { kind: 'list', selectedId: undefined },
    { kind: 'deployment', selectedId: id },
  ]);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_GETTER|"env"|"secrets"|"protectionBypass"/);
});
for (const [label, change] of [
  [
    'wrong project',
    (f) => {
      f.project.id = 'prj_other';
    },
  ],
  [
    'system exposure false',
    (f) => {
      f.project.autoExposeSystemEnvs = false;
    },
  ],
  [
    'wrong protection',
    (f) => {
      f.project.ssoProtection.deploymentType = 'none';
    },
  ],
  [
    'duplicate deployment',
    (f) => {
      f.list.deployments.push(f.row);
    },
  ],
  [
    'no deployment',
    (f) => {
      f.list.deployments = [];
    },
  ],
  [
    'wrong SHA',
    (f) => {
      f.row.meta.githubCommitSha = 'b'.repeat(40);
    },
  ],
  [
    'production',
    (f) => {
      f.row.target = 'production';
    },
  ],
  [
    'building',
    (f) => {
      f.row.readyState = 'BUILDING';
    },
  ],
  [
    'foreign URL',
    (f) => {
      f.row.url = 'foreign.example';
    },
  ],
  [
    'wrong exact resource',
    (f) => {
      f.deployment.id += 'x';
    },
  ],
  [
    'wrong owner',
    (f) => {
      f.deployment.ownerId = 'team_other';
    },
  ],
  [
    'wrong git source',
    (f) => {
      f.deployment.gitSource.sha = 'b'.repeat(40);
    },
  ],
  [
    'changed creation time',
    (f) => {
      f.deployment.createdAt++;
    },
  ],
])
  test('Preview read refuses ' + label + ' with fixed code and no further reads', async () => {
    const f = fixture();
    change(f);
    await assert.rejects(
      runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 }),
      /^Error: GW01_PREVIEW_(PROJECT|SELECTION|RESOURCE)$/,
    );
    assert.ok(f.calls.length <= 3);
  });
test('Preview command contract fixes branch/source/project/team and accepts only a safe deployment ID', () => {
  const args = previewArguments(packet, 'list');
  assert.equal(args[0], 'api');
  assert.equal(args[2], '--method');
  assert.equal(args[3], 'GET');
  const url = new URL(args[1], 'https://api.vercel.com');
  assert.equal(url.pathname, '/v7/deployments');
  assert.equal(url.searchParams.get('sha'), packet.sourceSha);
  assert.equal(url.searchParams.get('branch'), packet.branch);
  assert.equal(url.searchParams.get('projectId'), packet.projectId);
  assert.equal(url.searchParams.get('teamId'), packet.teamId);
  assert.throws(() => previewArguments(packet, 'deployment', '../env'), /GW01_PREVIEW_INPUT/);
  assert.throws(() => previewArguments({ ...packet, sourceSha: 'latest' }, 'list'), /GW01_PREVIEW_INPUT/);
});
test('Preview native child uses pinned preload, sparse environment, GET only and actual closure', async () => {
  let spec;
  const spawn = (_exe, args, options) => {
    spec = { args, options };
    const c = new EventEmitter();
    c.stdout = new PassThrough();
    c.stdin = new PassThrough();
    c.kill = () => c.emit('close', 1);
    queueMicrotask(() => {
      c.stdout.end('{"id":"public"}');
      c.emit('close', 0);
    });
    return c;
  };
  assert.deepEqual(await nativePreviewGet('synthetic-cli.js', packet, 'project', null, { spawn }), {
    id: 'public',
  });
  assert.equal(spec.args[0], '--import');
  assert.equal(spec.args[1], new URL('./gw01-vercel-no-retry.mjs', import.meta.url).href);
  assert.equal(spec.options.env.VERCEL_TOKEN, undefined);
  assert.equal(spec.options.env.PGPASSWORD, undefined);
  assert.equal(spec.options.stdio[2], 'ignore');
});
for (const mode of ['nonzero', 'timeout', 'no_close', 'stdin_throw'])
  test('Preview native ' + mode + ' emits fixed failure and never repeats GET', async () => {
    let calls = 0;
    const spawn = () => {
      calls++;
      const c = new EventEmitter();
      c.stdout = new PassThrough();
      c.stdin = new PassThrough();
      c.kill = () => {
        if (mode !== 'no_close') queueMicrotask(() => c.emit('close', 1));
      };
      if (mode === 'stdin_throw')
        c.stdin.end = () => {
          throw Error('RAW_PRIVATE');
        };
      if (mode === 'nonzero')
        queueMicrotask(() => {
          c.stdout.end('{"raw":"RAW_PRIVATE"}');
          c.emit('close', 1);
        });
      return c;
    };
    await assert.rejects(
      nativePreviewGet('synthetic-cli.js', packet, 'list', null, { spawn, timeoutMs: 5, closeMs: 5 }),
      mode === 'no_close' ? /^Error: GW01_PREVIEW_CLOSE$/ : /^Error: GW01_PREVIEW_NATIVE$/,
    );
    assert.equal(calls, 1);
  });
test('incomplete or unbounded list cannot select an exact Preview', async () => {
  for (const change of [
    (f) => {
      delete f.list.pagination.next;
    },
    (f) => {
      f.list.pagination.next = 123;
    },
    (f) => {
      f.list.deployments.push({ ...f.row, uid: 'dpl_AnotherSynthetic123456' });
    },
  ]) {
    const f = fixture();
    change(f);
    await assert.rejects(
      runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 }),
      /GW01_PREVIEW_SELECTION/,
    );
    assert.equal(f.calls.length, 2);
  }
});
test('Preview CheckOnly verifies synthetic full runtime inventory without executing CLI and blocks extra runtime files', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-preview-read-'));
  try {
    const put = (relative, value) => {
      const file = join(root, relative);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
      return file;
    };
    const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const source = put(
      'scripts/n8n/gw01-preview-read.mjs',
      readFileSync('scripts/n8n/gw01-preview-read.mjs', 'utf8'),
    );
    put('scripts/n8n/gw01-vercel-no-retry.mjs', readFileSync('scripts/n8n/gw01-vercel-no-retry.mjs', 'utf8'));
    put('scripts/n8n/gw01-preview-read-packet.json', packet);
    const runtime = 'appdata/npm/node_modules/vercel';
    put(runtime + '/package.json', { version: '56.5.0' });
    put(runtime + '/dist/index.js', "throw Error('MUST_NOT_EXECUTE_CLI');");
    const vercelFiles = {};
    for (const path of ['package.json', 'dist/index.js'])
      vercelFiles[path] = hash(readFileSync(join(root, runtime, path)));
    put('scripts/n8n/gw01-gateway-seal.json', { version: 1, files: {}, vercelFiles });
    const files = {};
    for (const path of [
      'scripts/n8n/gw01-preview-read.mjs',
      'scripts/n8n/gw01-vercel-no-retry.mjs',
      'scripts/n8n/gw01-preview-read-packet.json',
      'scripts/n8n/gw01-gateway-seal.json',
    ])
      files[path] = hash(readFileSync(join(root, path)));
    put('scripts/n8n/gw01-preview-read-seal.json', { version: 1, files });
    const run = () =>
      spawnSync(process.execPath, [source, 'CheckOnly'], {
        cwd: root,
        env: { APPDATA: join(root, 'appdata') },
        encoding: 'utf8',
        timeout: 3000,
      });
    const r = run();
    assert.equal(r.status, 0, r.stdout);
    assert.equal(JSON.parse(r.stdout).networkRequests, 0);
    put(runtime + '/dist/unreviewed.js', '// unexpected');
    const bad = run();
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stdout).code, 'GW01_PREVIEW_PREFLIGHT');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('selection diagnostics distinguish zero and multiple rows while rejecting both without resource GET', async () => {
  for (const count of [0, 2]) {
    const f = fixture();
    f.list.deployments = Array.from({ length: count }, () => f.row);
    let failure;
    try {
      await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
    } catch (e) {
      failure = previewFailure(e);
    }
    assert.equal(failure.status, 'unverified');
    assert.equal(failure.code, 'GW01_PREVIEW_SELECTION');
    assert.equal(failure.selectionDiagnostic.selectionCount, count);
    assert.equal(failure.selectionDiagnostic.selectionCountExact, true);
    assert.equal(failure.selectionDiagnostic.paginationComplete, true);
    assert.equal(failure.selectionDiagnostic.rows.length, count);
    assert.equal(f.calls.length, 2);
  }
});
test('selection diagnostics report fixed presence and validity flags without weakening optional-field assertions', async () => {
  const f = fixture();
  delete f.row.projectSettings.rootDirectory;
  delete f.row.target;
  f.row.meta.githubCommitSha = 'PRIVATE_RAW_SHA';
  for (const key of ['env', 'secrets', 'protectionBypass'])
    Object.defineProperty(f.row, key, {
      get() {
        throw Error('PRIVATE_GETTER');
      },
    });
  let failure;
  try {
    await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
  } catch (e) {
    failure = previewFailure(e);
  }
  const row = failure.selectionDiagnostic.rows[0];
  assert.equal(row.rootDirectoryPresent, false);
  assert.equal(row.rootDirectoryMatches, false);
  assert.equal(row.targetPresent, false);
  assert.equal(row.previewTarget, false);
  assert.equal(row.shaPresent, true);
  assert.equal(row.shaMatches, false);
  assert.equal(row.idValid, true);
  assert.equal(row.readyStateMatches, true);
  assert.ok(Object.values(row).every((v) => typeof v === 'boolean'));
  assert.doesNotMatch(
    JSON.stringify(failure),
    /PRIVATE_RAW_SHA|PRIVATE_GETTER|env_|dpl_|everyone-market-researcher-synthetic/,
  );
  assert.equal(f.calls.length, 2);
});
test('selection diagnostic is bounded and never forwards unknown names, values or caller error properties', async () => {
  const f = fixture();
  f.list.deployments = Array.from({ length: 21 }, () => ({ ...f.row, unknown: 'PRIVATE_UNAPPROVED' }));
  let failure;
  try {
    await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
  } catch (e) {
    failure = previewFailure(e);
  }
  assert.equal(failure.selectionDiagnostic.selectionCount, 20);
  assert.equal(failure.selectionDiagnostic.selectionCountExact, false);
  assert.equal(failure.selectionDiagnostic.rows.length, 20);
  assert.doesNotMatch(JSON.stringify(failure), /PRIVATE_UNAPPROVED|unknown/);
  const hostile = Error('GW01_PREVIEW_SELECTION');
  hostile.selectionDiagnostic = { raw: 'PRIVATE_ERROR' };
  assert.deepEqual(previewFailure(hostile), {
    version: 1,
    status: 'unverified',
    code: 'GW01_PREVIEW_SELECTION',
  });
  assert.deepEqual(previewFailure(Error('RAW_PRIVATE')), {
    version: 1,
    status: 'unverified',
    code: 'GW01_PREVIEW_REJECTED',
  });
});
test('optional list settings move framework proof to immutable resource and root proof to fresh project', async () => {
  const f = fixture();
  delete f.row.projectSettings;
  const r = await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
  assert.equal(r.status, 'verified');
  assert.equal(r.frameworkProof, 'fresh_project_and_deployment_resource');
  assert.equal(r.rootDirectoryProof, 'fresh_project_setting');
  assert.equal(r.listProjectSettingsPresent, false);
});
test('full exact SHA Git reference preserves exact branch metadata and commit binding', async () => {
  const f = fixture();
  f.deployment.gitSource.ref = packet.sourceSha;
  assert.equal(
    (await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 })).gitSourceRefMode,
    'exact_sha',
  );
});
for (const mutate of [
  (f) => {
    f.row.projectSettings.framework = 'other';
  },
  (f) => {
    f.row.projectSettings.rootDirectory = 'other';
  },
  (f) => {
    f.row.projectSettings = null;
  },
])
  test('explicit contradictory list settings remain rejected', async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(
      runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 }),
      /GW01_PREVIEW_SELECTION/,
    );
    assert.equal(f.calls.length, 2);
  });
for (const [name, mutate, flag] of [
  [
    'missing immutable framework',
    (f) => {
      delete f.row.projectSettings;
      delete f.deployment.projectSettings.framework;
    },
    'frameworkMatches',
  ],
  [
    'other Git reference',
    (f) => {
      f.deployment.gitSource.ref = 'other';
    },
    'gitSourceRefAccepted',
  ],
  [
    'short SHA reference',
    (f) => {
      f.deployment.gitSource.ref = packet.sourceSha.slice(0, 7);
    },
    'gitSourceRefAccepted',
  ],
  [
    'wrong branch metadata despite SHA ref',
    (f) => {
      f.deployment.gitSource.ref = packet.sourceSha;
      f.deployment.meta = { ...f.row.meta, githubCommitRef: 'main' };
    },
    'branchMatches',
  ],
  [
    'changed exact resource',
    (f) => {
      f.deployment.id += 'x';
    },
    'idMatches',
  ],
  [
    'contradictory resource root',
    (f) => {
      f.deployment.projectSettings.rootDirectory = 'other';
    },
    'rootDirectoryMatches',
  ],
])
  test('resource diagnostic rejects ' + name + ' with fixed fields only', async () => {
    const f = fixture();
    mutate(f);
    let r;
    try {
      await runPreviewRead(packet, { get: f.get, clock: () => createdAt + 1000 });
    } catch (e) {
      r = previewFailure(e);
    }
    assert.equal(r.code, 'GW01_PREVIEW_RESOURCE');
    assert.equal(r.resourceDiagnostic[flag], false);
    assert.ok(
      Object.entries(r.resourceDiagnostic).every(([key, v]) =>
        key === 'gitSourceRefMode' ? ['branch', 'exact_sha', 'other'].includes(v) : typeof v === 'boolean',
      ),
    );
    assert.doesNotMatch(JSON.stringify(r), /dpl_|PRIVATE_|everyone-market-researcher-synthetic/);
    assert.equal(f.calls.length, 3);
  });
