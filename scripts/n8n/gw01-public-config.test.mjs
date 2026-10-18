import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  publicConfigValues,
  inspectPublicConfiguration,
  runPublicConfiguration,
  publicConfigApiArguments,
  nativePublicConfigRequest,
} from './gw01-public-config.mjs';

const packet = {
  version: 1,
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  branch: 'm03-n8n-foundation',
  sourceSha: 'a'.repeat(40),
};
const project = {
  id: packet.projectId,
  accountId: packet.teamId,
  autoExposeSystemEnvs: true,
  rootDirectory: 'apps/web',
  framework: 'nextjs',
  ssoProtection: { deploymentType: 'all_except_custom_domains' },
};
const names = [
  'EMR_WORKER_GATEWAY_ENABLED',
  'EMR_WORKER_GATEWAY_AUDIENCE',
  'EMR_WORKER_GATEWAY_WINDOW_ID',
  'EMR_WORKER_GATEWAY_COMMIT_SHA',
];
const sensitive = ['EMR_WORKER_DB_PASSWORD', 'EMR_WORKER_GATEWAY_TOKEN_SHA256'];
function row(key, value, type = 'plain') {
  return {
    key,
    value,
    type,
    target: ['preview'],
    gitBranch: packet.branch,
    id: 'env_' + key,
    createdAt: 1792313743000,
    customEnvironmentIds: [],
  };
}
function records() {
  const values = publicConfigValues(packet);
  return names.map((name) => row(name, values[name]));
}
function fixture(rows = []) {
  const events = [],
    calls = [];
  let current = structuredClone(rows),
    failNext = false;
  const store = {
    read: () => (events.length ? structuredClone(events) : null),
    append: (event) => events.push(structuredClone(event)),
  };
  return {
    events,
    calls,
    store,
    rows: () => current,
    add: (r) => current.push(r),
    fail: () => {
      failNext = true;
    },
    ports: {
      store,
      clock: () => 1792313743000,
      proof: {
        version: 1,
        environmentReceipt: {
          version: 1,
          mode: 'Environment',
          status: 'complete',
          code: null,
          privacyStage: null,
          privacyParameterDiagnostic: null,
          privateRead: true,
          rootChildClosed: true,
          nativeExit: 0,
          handoffsRetained: true,
          delivery: {
            version: 1,
            status: 'complete',
            mode: 'Environment',
            managementRequests: 0,
            vercelCommands: 2,
            branch: packet.branch,
            previewOnly: true,
          },
        },
        environmentLedger: [
          {
            version: 1,
            kind: 'environment_intent',
            windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
            projectId: packet.projectId,
            branch: packet.branch,
            createdAt: new Date(1792313743000).toISOString(),
          },
          { kind: 'environment_delivered', name: sensitive[0] },
          { kind: 'environment_delivered', name: sensitive[1] },
        ],
        writerCloseReceipt: null,
      },
      request: async (method, path, body) => {
        calls.push({ method, path, body });
        if (method === 'GET' && !path.includes('/env')) return structuredClone(project);
        if (method === 'GET') return { envs: structuredClone(current) };
        if (method === 'PATCH') {
          const r = current.find((r) => path.includes('/env/' + r.id + '?'));
          r.value = body.value;
          return structuredClone(r);
        }
        if (method === 'DELETE') {
          current = current.filter((r) => !path.includes('/env/' + r.id + '?'));
          return { deleted: true };
        }
        current.push(row(body.key, body.value));
        if (failNext) {
          failNext = false;
          throw Error('RAW_SECRET_ERROR_MUST_NOT_SURFACE');
        }
        return { created: row(body.key, body.value), failed: [] };
      },
    },
  };
}
test('fixed public values use exact app names, selected source SHA and no secret fields', () => {
  assert.deepEqual(publicConfigValues(packet), {
    EMR_WORKER_GATEWAY_ENABLED: 'true',
    EMR_WORKER_GATEWAY_AUDIENCE: 'vercel-deployment',
    EMR_WORKER_GATEWAY_WINDOW_ID: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
    EMR_WORKER_GATEWAY_COMMIT_SHA: packet.sourceSha,
  });
  assert.throws(() => publicConfigValues({ ...packet, sourceSha: 'latest' }), /GW01_PUBLIC_CONFIG_INPUT/);
});
test('metadata projection never reads sensitive values and emits only approved public configuration', () => {
  const rows = records();
  for (const name of sensitive) {
    const r = row(name, 'unused', 'sensitive');
    Object.defineProperty(r, 'value', {
      get() {
        throw Error('MUST_NOT_READ_SECRET');
      },
    });
    rows.push(r);
  }
  const r = inspectPublicConfiguration(packet, project, { envs: rows });
  assert.equal(r.sensitiveMetadataVerified, true);
  assert.equal(r.autoExposeSystemEnvs, true);
  assert.deepEqual(r.configuration, {
    target: 'preview',
    gitBranch: packet.branch,
    values: publicConfigValues(packet),
  });
});
for (const [name, change] of [
  ['duplicate', (r) => r.push(structuredClone(r[0]))],
  ['shared branch', (r) => delete r[0].gitBranch],
  [
    'production scope',
    (r) => {
      r[0].target = ['preview', 'production'];
    },
  ],
  [
    'secret control',
    (r) => {
      r[0].type = 'sensitive';
    },
  ],
  [
    'conflicting value',
    (r) => {
      r[0].value = 'false';
    },
  ],
  [
    'shared config',
    (r) => {
      r[0].configurationId = 'icfg_shared';
    },
  ],
  [
    'custom environment',
    (r) => {
      r[0].customEnvironmentIds = ['env_custom'];
    },
  ],
])
  test('refuses ' + name + ' before any write', async () => {
    const rows = records();
    change(rows);
    const f = fixture(rows);
    await assert.rejects(runPublicConfiguration('Plan', packet, f.ports), /GW01_PUBLIC_CONFIG_CONFLICT/);
    assert.equal(
      f.calls.some((c) => c.method !== 'GET'),
      false,
    );
    assert.equal(f.events.length, 0);
  });
test('system-environment flag must be actual boolean true', () => {
  for (const value of [false, 'true', undefined])
    assert.throws(
      () => inspectPublicConfiguration(packet, { ...project, autoExposeSystemEnvs: value }, { envs: [] }),
      /GW01_PUBLIC_CONFIG_PROJECT/,
    );
});
for (const changes of [
  { rootDirectory: '.' },
  { framework: 'other' },
  { ssoProtection: { deploymentType: 'none' } },
])
  test('project build/protection drift blocks public delivery', () => {
    assert.throws(
      () => inspectPublicConfiguration(packet, { ...project, ...changes }, { envs: [] }),
      /GW01_PUBLIC_CONFIG_PROJECT/,
    );
  });
for (const count of [1, 2])
  test('Plan refuses ' + count + ' pre-existing sensitive metadata rows without any mutation', async () => {
    const f = fixture(sensitive.slice(0, count).map((key) => row(key, 'NEVER_READ', 'sensitive')));
    await assert.rejects(runPublicConfiguration('Plan', packet, f.ports), /GW01_PUBLIC_CONFIG_CONFLICT/);
    assert.ok(f.calls.every((c) => c.method === 'GET'));
    assert.equal(f.events.length, 0);
  });
test('Plan is GET-only; Apply journals before exactly four creation-only calls then verifies scope/values', async () => {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((c) => c.method === 'GET'));
  const r = await runPublicConfiguration('Apply', packet, f.ports);
  assert.equal(r.status, 'public_ready');
  assert.equal(r.sensitiveMetadataVerified, false);
  assert.equal(r.createdControls, 4);
  const mutations = f.calls.filter((c) => c.method === 'POST');
  assert.equal(mutations.length, 4);
  for (const c of mutations) {
    assert.equal(c.path.includes('upsert'), false);
    assert.deepEqual(Object.keys(c.body).sort(), ['gitBranch', 'key', 'target', 'type', 'value']);
    assert.equal(c.body.type, 'plain');
    assert.deepEqual(c.body.target, ['preview']);
  }
  assert.equal(f.events[1].kind, 'apply_intent');
  assert.equal(f.events.at(-1).kind, 'complete');
  await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
});
test('matching other three public values are reused and the enabled entry is newly created', async () => {
  const f = fixture(records().slice(1));
  await runPublicConfiguration('Plan', packet, f.ports);
  const r = await runPublicConfiguration('Apply', packet, f.ports);
  assert.equal(r.createdControls, 1);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});
test('matching pre-existing enabled flag is not adopted', async () => {
  const f = fixture(records());
  await assert.rejects(runPublicConfiguration('Plan', packet, f.ports), /GW01_PUBLIC_CONFIG_CONFLICT/);
  assert.equal(f.events.length, 0);
});
test('changed metadata after Plan blocks before one-use mutation intent', async () => {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  f.add(records()[1]);
  await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_DRIFT/);
  assert.equal(f.events.length, 1);
  assert.ok(f.calls.every((c) => c.method === 'GET'));
});
test('Apply rechecks plan age after fresh GETs before writing the intent', async () => {
  const f = fixture();
  let now = 1792313743000;
  f.ports.clock = () => now;
  await runPublicConfiguration('Plan', packet, f.ports);
  const original = f.ports.request;
  f.ports.request = async (...args) => {
    const result = await original(...args);
    if (args[0] === 'GET' && args[1].includes('/env?')) now += 1200001;
    return result;
  };
  await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
  assert.equal(f.events.length, 1);
  assert.ok(f.calls.every((c) => c.method === 'GET'));
});
test('ambiguous creation is not replayed; reconciliation is GET-only and remains incomplete until all four exist', async () => {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  f.fail();
  await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
  const count = f.calls.filter((c) => c.method === 'POST').length;
  assert.equal(count, 1);
  await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
  const r = await runPublicConfiguration('Reconcile', packet, f.ports);
  assert.equal(r.status, 'incomplete');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, count);
});
test('Verify requires only sensitive metadata and rejects unknown sensitive scope without reading values', async () => {
  const f = await readyFixture();
  const r = await runPublicConfiguration('Verify', packet, f.ports);
  assert.equal(r.status, 'verified');
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_MUST_NOT_EMIT/);
  f.rows().at(-1).gitBranch = 'other';
  await assert.rejects(runPublicConfiguration('Verify', packet, f.ports), /GW01_PUBLIC_CONFIG_CONFLICT/);
});
for (const count of [0, 1])
  test('Verify cannot pass with ' + count + ' sensitive metadata entries', async () => {
    const f = fixture(records());
    for (const key of sensitive.slice(0, count)) f.add(row(key, 'NEVER_READ', 'sensitive'));
    await assert.rejects(runPublicConfiguration('Verify', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
  });
test('native command allowlist has fixed endpoints and no pull, decrypt true, force or arbitrary method', () => {
  const args = publicConfigApiArguments('GET', 'envs');
  assert.ok(args.some((a) => a.includes('decrypt=false')));
  assert.equal(args.includes('--debug'), false);
  assert.throws(() => publicConfigApiArguments('DELETE', 'envs'), /GW01_PUBLIC_CONFIG_INPUT/);
  assert.throws(() => publicConfigApiArguments('GET', 'https://example.invalid'), /GW01_PUBLIC_CONFIG_INPUT/);
});
function fakeNative(text, mode = 'ok') {
  let calls = 0,
    spec;
  return {
    calls: () => calls,
    spec: () => spec,
    spawn: (_file, args, options) => {
      calls++;
      spec = { args, options };
      const c = new EventEmitter();
      c.stdout = new PassThrough();
      c.stdin = new PassThrough();
      c.kill = () => {
        if (mode !== 'no_close') queueMicrotask(() => c.emit('close', 1));
      };
      if (mode === 'stdin_throw')
        c.stdin.end = () => {
          throw Error('RAW_PRIVATE_MUST_NOT_EMIT');
        };
      queueMicrotask(() => {
        if (['hang', 'no_close', 'stdin_throw'].includes(mode)) return;
        c.stdout.end(text);
        c.emit('close', mode === 'native_error' ? 1 : 0);
      });
      return c;
    },
  };
}
test('native fixed GET waits for actual close, uses sparse environment and parses response privately', async () => {
  const f = fakeNative(JSON.stringify(project));
  const r = await nativePublicConfigRequest(
    'synthetic-cli.js',
    'GET',
    publicConfigApiArguments('GET', 'project')[1],
    null,
    { spawn: f.spawn },
  );
  assert.equal(r.id, packet.projectId);
  assert.equal(f.calls(), 1);
  assert.equal(f.spec().options.env.PGPASSWORD, undefined);
  assert.equal(f.spec().options.env.VERCEL_TOKEN, undefined);
  assert.equal(f.spec().options.stdio[2], 'ignore');
  assert.equal(f.spec().args[0], '--import');
  assert.equal(f.spec().args[1], new URL('./gw01-vercel-no-retry.mjs', import.meta.url).href);
  assert.equal(f.spec().args[2], 'synthetic-cli.js');
});
for (const mode of ['native_error', 'hang', 'no_close', 'stdin_throw'])
  test('native ' + mode + ' emits only a fixed failure and never retries', async () => {
    const f = fakeNative('{"raw":"PRIVATE_MUST_NOT_EMIT"}', mode);
    await assert.rejects(
      nativePublicConfigRequest('synthetic-cli.js', 'GET', publicConfigApiArguments('GET', 'envs')[1], null, {
        spawn: f.spawn,
        timeoutMs: 5,
        closeTimeoutMs: 5,
      }),
      mode === 'no_close' ? /^Error: GW01_PUBLIC_CONFIG_CLOSE$/ : /^Error: GW01_PUBLIC_CONFIG_NATIVE$/,
    );
    assert.equal(f.calls(), 1);
  });
test('native POST cannot write a wrong public value', async () => {
  const f = fakeNative('{}');
  await assert.rejects(
    async () =>
      nativePublicConfigRequest(
        'synthetic-cli.js',
        'POST',
        publicConfigApiArguments('POST', 'envs')[1],
        { type: 'plain', key: names[0], value: 'arbitrary', target: ['preview'], gitBranch: packet.branch },
        { spawn: f.spawn },
      ),
    /GW01_PUBLIC_CONFIG_INPUT/,
  );
  assert.equal(f.calls(), 0);
});
test('public plan preserves an unclosed child classification and does not create a journal', async () => {
  const f = fixture();
  f.ports.request = async () => {
    throw Error('GW01_PUBLIC_CONFIG_CLOSE');
  };
  await assert.rejects(runPublicConfiguration('Plan', packet, f.ports), /^Error: GW01_PUBLIC_CONFIG_CLOSE$/);
  assert.equal(f.events.length, 0);
});
test('actual CLI CheckOnly validates an isolated synthetic runtime without invoking it', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-public-config-preflight-'));
  try {
    const put = (relative, value) => {
      const path = join(root, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
      return path;
    };
    const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const source = readFileSync('scripts/n8n/gw01-public-config.mjs', 'utf8');
    const file = put('scripts/n8n/gw01-public-config.mjs', source);
    put('scripts/n8n/gw01-vercel-no-retry.mjs', readFileSync('scripts/n8n/gw01-vercel-no-retry.mjs', 'utf8'));
    put('scripts/n8n/gw01-public-config-packet.json', packet);
    put('scripts/n8n/gw01-cloud-privacy.json', {
      version: 1,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      instanceHost: 'muhhammedsayed.app.n8n.cloud',
      passed: true,
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      logCanaryVerified: true,
    });
    const runtime = 'fake-appdata/npm/node_modules/vercel';
    put(runtime + '/package.json', { version: '56.5.0' });
    put(runtime + '/dist/index.js', "throw Error('SYNTHETIC_CLI_MUST_NOT_EXECUTE');");
    const vercelFiles = {};
    for (const path of ['package.json', 'dist/index.js'])
      vercelFiles[path] = sha(readFileSync(join(root, runtime, path)));
    put('scripts/n8n/gw01-gateway-seal.json', { version: 1, files: {}, vercelFiles });
    const files = {};
    for (const path of [
      'scripts/n8n/gw01-public-config.mjs',
      'scripts/n8n/gw01-vercel-no-retry.mjs',
      'scripts/n8n/gw01-public-config-packet.json',
      'scripts/n8n/gw01-cloud-privacy.json',
      'scripts/n8n/gw01-gateway-seal.json',
    ])
      files[path] = sha(readFileSync(join(root, path)));
    put('scripts/n8n/gw01-public-config-seal.json', { version: 1, files });
    const run = () =>
      spawnSync(process.execPath, [file, 'CheckOnly'], {
        cwd: root,
        env: { APPDATA: join(root, 'fake-appdata') },
        encoding: 'utf8',
        timeout: 3000,
      });
    const r = run();
    assert.equal(r.status, 0, r.stdout);
    assert.deepEqual(JSON.parse(r.stdout), {
      version: 1,
      status: 'check_only_ready',
      privateRead: false,
      networkRequests: 0,
    });
    put(runtime + '/dist/added.js', '// unreviewed synthetic runtime');
    const bad = run();
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stdout).code, 'GW01_PUBLIC_CONFIG_PREFLIGHT');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
function closeReceipt() {
  return {
    version: 1,
    mode: 'Close',
    status: 'complete',
    privateRead: true,
    rootChildClosed: true,
    handoffRetained: true,
    nativeExit: 0,
    result: {
      version: 1,
      status: 'complete',
      mode: 'Close',
      code: null,
      authorizationDenials: 0,
      connectionClosed: true,
      identity: {
        currentUser: 'n8n_writer',
        sessionUser: 'n8n_writer',
        database: 'postgres',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
      },
      window: {
        id: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
        closed: true,
        startsAt: null,
        expiresAt: null,
        totalAdmitted: 0,
        boundAudience: null,
        boundCommitSha: null,
        boundDeploymentId: null,
      },
    },
  };
}
async function readyFixture() {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  await runPublicConfiguration('Apply', packet, f.ports);
  for (const key of sensitive) f.add(row(key, 'NEVER_READ_OR_EMIT', 'sensitive'));
  await runPublicConfiguration('Verify', packet, f.ports);
  f.ports.proof.writerCloseReceipt = closeReceipt();
  return f;
}
test('closed-window closeout disables only own enabled entry and removes only the two owned sensitive entries', async () => {
  const f = await readyFixture();
  f.add(row('UNRELATED_OWNER_VALUE', 'UNRELATED_PRIVATE', 'encrypted'));
  const d = await runPublicConfiguration('Disable', packet, f.ports);
  assert.equal(d.status, 'disabled');
  const r = await runPublicConfiguration('Cleanup', packet, f.ports);
  assert.equal(r.status, 'cleanup_complete');
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 2);
  assert.equal(f.rows().find((r) => r.key === names[0]).value, 'false');
  assert.equal(
    f.rows().some((r) => r.key === 'UNRELATED_OWNER_VALUE'),
    true,
  );
  assert.doesNotMatch(JSON.stringify(r), /UNRELATED_PRIVATE|NEVER_READ_OR_EMIT/);
});
test('unclosed writer receipt cannot authorize a configuration mutation', async () => {
  const f = await readyFixture();
  f.ports.proof.writerCloseReceipt.result.window.closed = false;
  const before = f.calls.length;
  await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_CLOSED/);
  assert.equal(f.calls.length, before);
});
test('PostgreSQL closeout accepts untouched microsecond offset timestamps for the exact thirty-minute window', async () => {
  const f = await readyFixture(),
    window = f.ports.proof.writerCloseReceipt.result.window;
  window.startsAt = '2026-10-18T10:00:00.123456+00:00';
  window.expiresAt = '2026-10-18T10:30:00.123456+00:00';
  const original = structuredClone(f.ports.proof.writerCloseReceipt);
  assert.equal((await runPublicConfiguration('Disable', packet, f.ports)).status, 'disabled');
  assert.equal((await runPublicConfiguration('Cleanup', packet, f.ports)).status, 'cleanup_complete');
  assert.deepEqual(f.ports.proof.writerCloseReceipt, original);
});
test('PostgreSQL closeout still accepts canonical UTC milliseconds', async () => {
  const f = await readyFixture(),
    window = f.ports.proof.writerCloseReceipt.result.window;
  window.startsAt = '2026-10-18T10:00:00.123Z';
  window.expiresAt = '2026-10-18T10:30:00.123Z';
  assert.equal((await runPublicConfiguration('Disable', packet, f.ports)).status, 'disabled');
});
for (const [label, start, end] of [
  ['different microsecond duration', '2026-10-18T10:00:00.123456+00:00', '2026-10-18T10:30:00.123457+00:00'],
  ['wrong millisecond duration', '2026-10-18T10:00:00.123Z', '2026-10-18T10:29:59.123Z'],
  ['reversed window', '2026-10-18T10:30:00.123456+00:00', '2026-10-18T10:00:00.123456+00:00'],
  ['impossible calendar date', '2026-02-30T10:00:00.123456+00:00', '2026-02-30T10:30:00.123456+00:00'],
  ['extra precision', '2026-10-18T10:00:00.1234567+00:00', '2026-10-18T10:30:00.1234567+00:00'],
  ['missing timezone', '2026-10-18T10:00:00.123456', '2026-10-18T10:30:00.123456'],
  ['invalid offset', '2026-10-18T10:00:00.123456+14:01', '2026-10-18T10:30:00.123456+14:01'],
  ['mixed null bounds', null, '2026-10-18T10:30:00.123456+00:00'],
])
  test('PostgreSQL closeout rejects ' + label + ' before API access', async () => {
    const f = await readyFixture(),
      window = f.ports.proof.writerCloseReceipt.result.window;
    window.startsAt = start;
    window.expiresAt = end;
    const before = f.calls.length;
    await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_CLOSED/);
    assert.equal(f.calls.length, before);
  });
test('PostgreSQL closeout change does not relax the canonical Environment ledger timestamp', async () => {
  const f = fixture();
  f.ports.proof.environmentLedger[0].createdAt = '2026-10-18T10:00:00.123456+00:00';
  await assert.rejects(runPublicConfiguration('Verify', packet, f.ports), /GW01_PUBLIC_CONFIG_OWNERSHIP/);
  assert.equal(f.calls.length, 0);
});
for (const [label, change] of [
  [
    'native failure',
    (p) => {
      p.nativeExit = 1;
    },
  ],
  [
    'unclosed child',
    (p) => {
      p.rootChildClosed = false;
    },
  ],
  [
    'different session identity',
    (p) => {
      p.result.identity.sessionUser = 'postgres';
    },
  ],
  [
    'different project',
    (p) => {
      p.result.identity.projectRef = 'hkiafqrcxaafdbcvjlzv';
    },
  ],
  [
    'different window',
    (p) => {
      p.result.window.id = '00000000-0000-4000-8000-000000000000';
    },
  ],
])
  test('closeout rejects ' + label + ' before API access', async () => {
    const f = await readyFixture();
    change(f.ports.proof.writerCloseReceipt);
    const before = f.calls.length;
    await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_CLOSED/);
    assert.equal(f.calls.length, before);
  });
for (const [label, change] of [
  [
    'failed Environment',
    (p) => {
      p.environmentReceipt.nativeExit = 1;
    },
  ],
  [
    'partial Environment ledger',
    (p) => {
      p.environmentLedger.pop();
    },
  ],
  [
    'wrong Environment branch',
    (p) => {
      p.environmentLedger[0].branch = 'main';
    },
  ],
  [
    'wrong Environment project',
    (p) => {
      p.environmentLedger[0].projectId = 'prj_other';
    },
  ],
])
  test('Verify rejects ' + label + ' before API access', async () => {
    const f = fixture();
    change(f.ports.proof);
    await assert.rejects(runPublicConfiguration('Verify', packet, f.ports), /GW01_PUBLIC_CONFIG_OWNERSHIP/);
    assert.equal(f.calls.length, 0);
  });
test('closeout refuses a recreated public flag or changed sensitive metadata', async () => {
  const f = await readyFixture();
  f.rows().find((r) => r.key === names[0]).id = 'other_id';
  await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_OWNERSHIP/);
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 0);
  const g = await readyFixture();
  await runPublicConfiguration('Disable', packet, g.ports);
  g.rows().find((r) => r.key === sensitive[1]).createdAt++;
  await assert.rejects(runPublicConfiguration('Cleanup', packet, g.ports), /GW01_PUBLIC_CONFIG_OWNERSHIP/);
  assert.equal(g.calls.filter((c) => c.method === 'DELETE').length, 0);
});
test('lost PATCH acknowledgement permits GET-only reconciliation and never repeated PATCH', async () => {
  const f = await readyFixture();
  const request = f.ports.request;
  f.ports.request = async (...args) => {
    const value = await request(...args);
    if (args[0] === 'PATCH') throw Error('PRIVATE_LOST_ACK');
    return value;
  };
  await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
  await assert.rejects(runPublicConfiguration('Disable', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
  const before = f.calls.length;
  assert.equal((await runPublicConfiguration('ReconcileCleanup', packet, f.ports)).status, 'disabled');
  assert.ok(f.calls.slice(before).every((c) => c.method === 'GET'));
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 1);
});
test('lost DELETE acknowledgement reconciles absence without repeating the completed DELETE', async () => {
  const f = await readyFixture();
  await runPublicConfiguration('Disable', packet, f.ports);
  const request = f.ports.request;
  let lost = false;
  f.ports.request = async (...args) => {
    const value = await request(...args);
    if (args[0] === 'DELETE' && !lost) {
      lost = true;
      throw Error('PRIVATE_LOST_ACK');
    }
    return value;
  };
  await assert.rejects(runPublicConfiguration('Cleanup', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
  await assert.rejects(runPublicConfiguration('Cleanup', packet, f.ports), /GW01_PUBLIC_CONFIG_RECONCILE/);
  const before = f.calls.length;
  await runPublicConfiguration('ReconcileCleanup', packet, f.ports);
  assert.ok(f.calls.slice(before).every((c) => c.method === 'GET'));
  assert.equal((await runPublicConfiguration('Cleanup', packet, f.ports)).status, 'cleanup_complete');
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 2);
});
test('prepared closed-window abort disables owned flag without fabricating Environment provenance', async () => {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  await runPublicConfiguration('Apply', packet, f.ports);
  f.ports.proof = {
    version: 1,
    environmentReceipt: null,
    environmentLedger: null,
    writerCloseReceipt: closeReceipt(),
  };
  assert.equal((await runPublicConfiguration('Disable', packet, f.ports)).status, 'cleanup_complete');
  assert.equal((await runPublicConfiguration('Cleanup', packet, f.ports)).status, 'cleanup_complete');
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 0);
});
test('Verify and closeout never access sensitive value getters or persist sensitive row bodies', async () => {
  const f = await readyFixture();
  for (const r of f.rows().filter((r) => sensitive.includes(r.key))) {
    Object.defineProperty(r, 'value', {
      get() {
        throw Error('MUST_NOT_READ_SENSITIVE');
      },
    });
  }
  const request = f.ports.request;
  f.ports.request = async (method, path, body) => {
    if (method === 'GET' && path.includes('/env?')) {
      f.calls.push({ method, path, body });
      return { envs: f.rows() };
    }
    return request(method, path, body);
  };
  assert.equal((await runPublicConfiguration('Verify', packet, f.ports)).status, 'verified');
  await runPublicConfiguration('Disable', packet, f.ports);
  assert.equal((await runPublicConfiguration('Cleanup', packet, f.ports)).status, 'cleanup_complete');
  assert.doesNotMatch(JSON.stringify(f.events), /NEVER_READ_OR_EMIT|MUST_NOT_READ_SENSITIVE/);
});
for (const failed of [[{ message: 'PRIVATE_PROVIDER_ERROR' }], true, {}])
  test('creation rejects nonempty or invalid failed response ' + JSON.stringify(failed), async () => {
    const f = fixture();
    await runPublicConfiguration('Plan', packet, f.ports);
    const request = f.ports.request;
    f.ports.request = async (...args) => {
      const value = await request(...args);
      return args[0] === 'POST' ? { ...value, failed } : value;
    };
    await assert.rejects(runPublicConfiguration('Apply', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
    assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  });
test('documented creation response with empty failed array records original POST metadata', async () => {
  const f = fixture();
  await runPublicConfiguration('Plan', packet, f.ports);
  assert.equal((await runPublicConfiguration('Apply', packet, f.ports)).status, 'public_ready');
  assert.equal(f.events.filter((e) => e.kind === 'public_created').length, 4);
});
test('metadata accepts canonical numeric timestamps but rejects Boolean and noncanonical values', () => {
  const rows = records();
  rows[0].createdAt = String(rows[0].createdAt);
  assert.equal(
    inspectPublicConfiguration(packet, project, { envs: rows }).metadata[names[0]].createdAt,
    1792313743000,
  );
  for (const v of [true, false, '01792313743000', '1e3', '-1', 1.5]) {
    rows[0].createdAt = v;
    assert.throws(
      () => inspectPublicConfiguration(packet, project, { envs: rows }),
      /GW01_PUBLIC_CONFIG_OWNERSHIP/,
    );
  }
});
test('closeout uses the documented v9 entry routes and only fixed false PATCH or body-free DELETE', async () => {
  const expected = `/v9/projects/${packet.projectId}/env/owned_entry?teamId=${packet.teamId}`;
  assert.equal(publicConfigApiArguments('PATCH', 'entry', 'owned_entry')[1], expected);
  assert.equal(publicConfigApiArguments('DELETE', 'entry', 'owned_entry')[1], expected);
  assert.ok(
    publicConfigApiArguments('DELETE', 'entry', 'owned_entry').includes('--dangerously-skip-permissions'),
  );
  for (const [method, kind] of [
    ['GET', 'project'],
    ['GET', 'envs'],
    ['POST', 'envs'],
    ['PATCH', 'entry'],
  ])
    assert.equal(
      publicConfigApiArguments(method, kind, kind === 'entry' ? 'owned_entry' : null).includes(
        '--dangerously-skip-permissions',
      ),
      false,
    );
  const patch = fakeNative('{}');
  await nativePublicConfigRequest(
    'synthetic-cli.js',
    'PATCH',
    expected,
    { value: 'false' },
    { spawn: patch.spawn },
  );
  assert.equal(patch.calls(), 1);
  for (const body of [{ value: 'true' }, { value: 'false', key: 'other' }, null])
    await assert.rejects(
      async () =>
        nativePublicConfigRequest('synthetic-cli.js', 'PATCH', expected, body, { spawn: patch.spawn }),
      /GW01_PUBLIC_CONFIG_INPUT/,
    );
  assert.equal(patch.calls(), 1);
  const deletion = fakeNative('');
  assert.deepEqual(
    await nativePublicConfigRequest('synthetic-cli.js', 'DELETE', expected, null, { spawn: deletion.spawn }),
    { deleted: true },
  );
  assert.equal(deletion.calls(), 1);
  await assert.rejects(
    async () =>
      nativePublicConfigRequest(
        'synthetic-cli.js',
        'DELETE',
        expected,
        { value: 'anything' },
        { spawn: deletion.spawn },
      ),
    /GW01_PUBLIC_CONFIG_INPUT/,
  );
  assert.equal(deletion.calls(), 1);
});
async function pendingCleanupFixture() {
  const f = await readyFixture();
  await runPublicConfiguration('Disable', packet, f.ports);
  const request = f.ports.request;
  f.ports.request = async (...args) => {
    if (args[0] === 'DELETE') throw Error('SYNTHETIC_CLI_CONFIRMATION_REQUIRED');
    return request(...args);
  };
  await assert.rejects(runPublicConfiguration('Cleanup', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
  f.ports.request = request;
  return f;
}
test('explicit ResumeCleanup preserves failed intent and records one readback-bound resumed delete before second fresh intent', async () => {
  const f = await pendingCleanupFixture();
  const original = structuredClone(f.events.find((e) => e.kind === 'delete_intent'));
  const r = await runPublicConfiguration('ResumeCleanup', packet, f.ports);
  assert.equal(r.status, 'cleanup_complete');
  assert.deepEqual(
    f.events.find((e) => e.kind === 'delete_intent'),
    original,
  );
  assert.equal(f.events.filter((e) => e.kind === 'delete_resumed_after_readback').length, 1);
  assert.equal(f.events.filter((e) => e.kind === 'delete_intent').length, 2);
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 2);
  assert.equal(f.events.filter((e) => e.kind === 'deleted').length, 2);
  await assert.rejects(
    runPublicConfiguration('ResumeCleanup', packet, f.ports),
    /GW01_PUBLIC_CONFIG_(OWNERSHIP|RECONCILE)/,
  );
});
for (const [label, change] of [
  [
    'absent pending row',
    (f) => {
      f.rows().splice(
        f.rows().findIndex((r) => r.key === sensitive[0]),
        1,
      );
    },
  ],
  [
    'different ID',
    (f) => {
      f.rows().find((r) => r.key === sensitive[0]).id = 'changed_id';
    },
  ],
  [
    'different creation time',
    (f) => {
      f.rows().find((r) => r.key === sensitive[0]).createdAt++;
    },
  ],
  [
    'different branch',
    (f) => {
      f.rows().find((r) => r.key === sensitive[0]).gitBranch = 'main';
    },
  ],
  [
    'different type',
    (f) => {
      f.rows().find((r) => r.key === sensitive[0]).type = 'plain';
    },
  ],
  [
    'duplicate pending intent',
    (f) => {
      f.events.push(structuredClone(f.events.find((e) => e.kind === 'delete_intent')));
    },
  ],
  [
    'conflicting deleted marker',
    (f) => {
      const e = f.events.find((e) => e.kind === 'delete_intent');
      f.events.push({ ...e, kind: 'deleted' });
    },
  ],
  [
    'unknown event kind',
    (f) => {
      const e = f.events[0];
      f.events.push({ ...e, kind: 'unapproved_cleanup_override' });
    },
  ],
  [
    'incompatible disable ordering',
    (f) => {
      const i = f.events.findIndex((e) => e.kind === 'disabled');
      f.events.splice(i, 1);
    },
  ],
])
  test('ResumeCleanup refuses ' + label + ' without DELETE', async () => {
    const f = await pendingCleanupFixture();
    change(f);
    const before = f.calls.filter((c) => c.method === 'DELETE').length;
    await assert.rejects(
      runPublicConfiguration('ResumeCleanup', packet, f.ports),
      /GW01_PUBLIC_CONFIG_(OWNERSHIP|CONFLICT|RECONCILE)/,
    );
    assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, before);
  });
test('ambiguous resumed DELETE is never resumed again and GET-only reconciliation preserves a remaining owned row', async () => {
  const f = await pendingCleanupFixture(),
    base = f.ports.request;
  f.ports.request = async (...args) => {
    const r = await base(...args);
    if (args[0] === 'DELETE') throw Error('SYNTHETIC_LOST_ACK');
    return r;
  };
  await assert.rejects(runPublicConfiguration('ResumeCleanup', packet, f.ports), /GW01_PUBLIC_CONFIG_NATIVE/);
  await assert.rejects(
    runPublicConfiguration('ResumeCleanup', packet, f.ports),
    /GW01_PUBLIC_CONFIG_RECONCILE/,
  );
  const before = f.calls.length;
  await runPublicConfiguration('ReconcileCleanup', packet, f.ports);
  assert.ok(f.calls.slice(before).every((c) => c.method === 'GET'));
  f.ports.request = base;
  assert.equal((await runPublicConfiguration('Cleanup', packet, f.ports)).status, 'cleanup_complete');
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, 2);
});
for (const response of [
  null,
  [],
  [null, { key: 'OWNED', type: 'sensitive', value: 'PRIVATE_DELETE_RESPONSE' }],
  { key: 'OWNED', type: 'sensitive', value: 'PRIVATE_DELETE_RESPONSE' },
])
  test(
    'documented successful DELETE response is opaque and still requires separate absence readback ' +
      (response === null ? 'null' : Array.isArray(response) ? 'array' : 'object'),
    async () => {
      const f = fakeNative(JSON.stringify(response));
      const r = await nativePublicConfigRequest(
        'synthetic-cli.js',
        'DELETE',
        publicConfigApiArguments('DELETE', 'entry', 'owned_entry')[1],
        null,
        { spawn: f.spawn },
      );
      assert.deepEqual(r, { deleted: true });
      assert.doesNotMatch(JSON.stringify(r), /PRIVATE_DELETE_RESPONSE/);
    },
  );
for (const response of [true, 123, 'private', [true], { error: { message: 'PRIVATE_API_ERROR' } }])
  test('unsupported DELETE response fails closed without values ' + typeof response, async () => {
    const f = fakeNative(JSON.stringify(response));
    await assert.rejects(
      nativePublicConfigRequest(
        'synthetic-cli.js',
        'DELETE',
        publicConfigApiArguments('DELETE', 'entry', 'owned_entry')[1],
        null,
        { spawn: f.spawn },
      ),
      /^Error: GW01_PUBLIC_CONFIG_NATIVE$/,
    );
  });
