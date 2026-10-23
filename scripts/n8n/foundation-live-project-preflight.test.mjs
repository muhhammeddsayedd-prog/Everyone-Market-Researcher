import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  renameSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = new URL('./', import.meta.url);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const canary = 'SYNTHETIC_PRIVATE_PROJECT_PREFLIGHT';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = () => ({
  kind: 'm03_vercel_saved_auth_metadata',
  status: 'metadata_covers_75_minutes',
  metadataValid: true,
  unexpired: true,
  covers75Minutes: true,
  effectiveBackendEstablished: false,
  networkRequests: 0,
  authenticationAttempted: false,
  refreshAttempted: false,
  configWritten: false,
  childClosed: true,
});
const project = () => ({
  id: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  accountId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  rootDirectory: 'apps/web',
  nodeVersion: '24.x',
  framework: 'nextjs',
  link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
  ssoProtection: { deploymentType: 'all_except_custom_domains' },
  protectionBypass: {},
  error: canary,
});

async function fixture(action, { mode = 'success' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-project-preflight-test-'));
  const owner = randomUUID();
  const put = (relative, data) => {
    const path = join(directory, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    return path;
  };
  put('.owner', owner);
  try {
    for (const name of [
      'foundation-live-setup-transport.mjs',
      'foundation-live-setup-no-retry.mjs',
      'foundation-live-setup-diagnostic.mjs',
      'foundation-vercel-auth-preflight.mjs',
    ])
      put('scripts/n8n/' + name, readFileSync(new URL(name, here)));
    const machine = {
      platform: process.platform,
      profile: process.env.USERPROFILE ?? process.env.HOME,
      appData: process.env.APPDATA ?? directory,
      localTemp: put('local/Temp/.owner', 'owned synthetic fixture').replace(/[/\\]\.owner$/, ''),
      nodePath: process.execPath,
      nodeSha256: hash(readFileSync(process.execPath)),
      cliRoot: join(directory, 'synthetic-cli'),
    };
    let source = readFileSync(new URL('foundation-live-project-preflight.mjs', here), 'utf8');
    assert.match(source, /const machine = Object\.freeze\(\{[\s\S]*?\n\}\);/);
    source = source.replace(
      /const machine = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const machine = Object.freeze(' + JSON.stringify(machine) + ');',
    );
    const attemptRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json';
    const followupRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-followup-20261022.json';
    const checkpointRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json';
    const attempt = JSON.parse(readFileSync(join(repo, attemptRelative), 'utf8'));
    const checkpoint = JSON.parse(readFileSync(join(repo, checkpointRelative), 'utf8'));
    const followup = JSON.parse(readFileSync(join(repo, followupRelative), 'utf8'));
    const line = (v) => JSON.stringify(v) + '\n';
    for (const row of attempt.publicArtifacts) {
      let bytes = Buffer.from(line({ syntheticPublicArtifact: true }));
      if (row.path.endsWith('/management.jsonl'))
        bytes = Buffer.from(
          line({
            event: 'management_header',
            version: 1,
            sourceCommitSha: attempt.applicationSource,
            deadlineAt: 1792584023481,
          }) +
            line({ event: 'management_attempt', ordinal: 1 }) +
            line({ event: 'management_attempt', ordinal: 2 }),
        );
      if (row.path.endsWith('/control.jsonl'))
        bytes = Buffer.from(
          Array.from({ length: 200 }, (_, i) =>
            line({
              event: 'control_request_intent',
              kind: 'discovery',
              ordinal: i + 1,
              workflowId: 'SyntheticOwned',
              at: 1,
            }),
          ).join(''),
        );
      if (row.path.endsWith('/setup.jsonl'))
        bytes = Buffer.from(
          line({ event: 'setup_attempt', kind: 'GET', ordinal: 1, at: 1 }) +
            line({ event: 'setup_attempt', kind: 'GET', ordinal: 2, at: 2 }),
        );
      put(row.path, bytes);
      row.sha256 = hash(bytes);
    }
    checkpoint.preserved = Object.fromEntries(
      Array.from({ length: 24 }, (_, i) => {
        const path = 'scripts/synthetic-history/record-' + i + '.json';
        const bytes = Buffer.from(line({ preservedOrdinal: i }));
        put(path, bytes);
        return [path, hash(bytes)];
      }),
    );
    const attemptBytes = Buffer.from(line(attempt));
    followup.actualAttemptSha256 = hash(attemptBytes);
    const recordPins = {};
    for (const [path, bytes] of [
      [attemptRelative, attemptBytes],
      [followupRelative, Buffer.from(line(followup))],
      [checkpointRelative, Buffer.from(line(checkpoint))],
    ]) {
      put(path, bytes);
      recordPins[path] = hash(bytes);
    }
    const cliPins = {};
    for (const path of [
      'package.json',
      'dist/chunks/chunk-3BHSS5E2.js',
      'dist/index.js',
      'node_modules/@vercel/cli-auth/credentials-store.js',
    ]) {
      const bytes = Buffer.from('// Synthetic public CLI bytes; never executed.\n' + path + '\n');
      put('synthetic-cli/' + path, bytes);
      cliPins[path] = hash(bytes);
    }
    assert.match(source, /recordPins: Object\.freeze\(\{[\s\S]*?\n  \}\),/);
    source = source.replace(
      /recordPins: Object\.freeze\(\{[\s\S]*?\n  \}\),/,
      'recordPins: Object.freeze(' + JSON.stringify(recordPins) + '),',
    );
    source = source.replace(
      'cliPins: foundationSetupVercelPins,',
      'cliPins: Object.freeze(' + JSON.stringify(cliPins) + '),',
    );
    // The retired real reader retains its historical source pins. This copied
    // synthetic reader seals the current fixture bytes before drift exercises.
    const copiedSourcePins = Object.fromEntries(
      [
        'foundation-live-setup-transport.mjs',
        'foundation-live-setup-no-retry.mjs',
        'foundation-live-setup-diagnostic.mjs',
        'foundation-vercel-auth-preflight.mjs',
      ].map((name) => ['scripts/n8n/' + name, hash(readFileSync(join(directory, 'scripts/n8n', name)))]),
    );
    source = source.replace(
      /const sourcePins = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const sourcePins = Object.freeze(' + JSON.stringify(copiedSourcePins) + ');',
    );
    put('scripts/n8n/foundation-live-project-preflight.mjs', source);
    const mod = await import(
      pathToFileURL(join(directory, 'scripts/n8n/foundation-live-project-preflight.mjs')).href
    );
    const c = mod.foundationLiveProjectPreflightCheckpoint;
    const oldBytes = new Map(
      ['management', 'control', 'setup'].map((name) => {
        const relative = 'scripts/n8n/out/foundation/live/' + name + '.jsonl';
        return [relative, readFileSync(join(directory, relative))];
      }),
    );
    let metadataCalls = 0,
      cliCalls = 0;
    const children = [];
    const deps = {
      processAlive: () => false,
      readMetadata: async () => {
        metadataCalls++;
        return metadata();
      },
      transportDependencies: {
        requestTimeoutMs: mode === 'unclosed' ? 2 : 20000,
        closeGraceMs: mode === 'unclosed' ? 1 : 5000,
        spawn(executable, args, options) {
          cliCalls++;
          assert.equal(metadataCalls, 1);
          assert.equal(executable, process.execPath);
          assert.equal(args.includes('--input'), false);
          assert.equal(options.shell, false);
          assert.equal(options.env.EMR_FOUNDATION_SETUP_METHOD, 'GET');
          assert.equal(options.env.EMR_FOUNDATION_SETUP_PATH, c.projectPath);
          for (const name of [
            'NODE_OPTIONS',
            'VERCEL_TOKEN',
            'VERCEL_TOKEN_STORAGE',
            'XDG_DATA_HOME',
            'PGPASSWORD',
          ])
            assert.equal(Object.hasOwn(options.env, name), false);
          const child = new EventEmitter();
          Object.assign(child, {
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            stderr: new PassThrough(),
            kill() {},
          });
          children.push(child);
          setImmediate(() => {
            child.emit('spawn');
            if (mode === 'unclosed') return;
            if (mode === 'dns') {
              child.stderr.write(canary + ' ENOTFOUND');
              child.emit('close', 1);
              return;
            }
            const dto = project();
            if (mode === 'contract') dto.nodeVersion = '20.x';
            const status = mode === 'http' ? 401 : 200;
            child.stdout.write(
              'HTTP ' + status + ' Synthetic\ncontent-type: application/json\n\n' + JSON.stringify(dto),
            );
            if (mode === 'parent_replaced') {
              const path = join(machine.localTemp, c.parentLockFilename);
              renameSync(path, path + '.owned');
              writeFileSync(path, canary, { flag: 'wx' });
            }
            child.emit('close', 0);
          });
          return child;
        },
      },
    };
    await action({
      mod,
      c,
      directory,
      machine,
      put,
      deps,
      metadataCalls: () => metadataCalls,
      cliCalls: () => cliCalls,
      oldBytes,
    });
    for (const [relative, bytes] of oldBytes)
      assert.deepEqual(readFileSync(join(directory, relative)), bytes);
    for (const child of children) for (const name of ['stdin', 'stdout', 'stderr']) child[name].destroy();
  } finally {
    const actual = realpathSync(directory),
      temp = realpathSync(tmpdir()),
      within = relative(temp, actual);
    assert.equal(isAbsolute(within), false);
    assert.equal(within.startsWith('..'), false);
    assert.equal(dirname(actual), temp);
    assert.equal(basename(actual).startsWith('emr-project-preflight-test-'), true);
    assert.equal(readFileSync(join(actual, '.owner'), 'utf8'), owner);
    rmSync(actual, { recursive: true });
  }
}

test('public CheckOnly never reads saved auth or creates the one-use ledger', () =>
  fixture(async (f) => {
    const r = f.mod.checkFoundationLiveProjectPreflight(f.deps);
    assert.equal(r.privateRead, false);
    assert.equal(r.networkRequests, 0);
    assert.equal(r.managementAttempts, 5);
    assert.equal(r.controlAttempts, 201);
    assert.equal(r.combinedAttempts, 206);
    assert.equal(f.metadataCalls(), 0);
    assert.equal(f.cliCalls(), 0);
    assert.equal(existsSync(join(f.directory, f.c.ledgerRelative)), false);
  }));

for (const mode of ['success', 'dns', 'http', 'contract'])
  test('one-use fixed project GET and explicit outside debit: ' + mode, () =>
    fixture(
      async (f) => {
        const r = await f.mod.runFoundationLiveProjectPreflight(f.deps);
        assert.equal(
          r.status,
          {
            success: 'project_contract_ready',
            dns: 'transport_rejected',
            http: 'project_http_rejected',
            contract: 'project_contract_rejected',
          }[mode],
        );
        assert.equal(r.managementAttempts, 6);
        assert.equal(r.controlAttempts, 201);
        assert.equal(r.combinedAttempts, 207);
        assert.equal(r.getAttemptDebited, true);
        assert.equal(r.childTransportsClosed, true);
        assert.equal(r.newAcceptanceWindow, false);
        assert.equal(r.mutations, 0);
        assert.equal(f.metadataCalls(), 1);
        assert.equal(f.cliCalls(), 1);
        assert.deepEqual(
          Object.keys(r.transport).sort(),
          ['stage', 'code', 'httpStatus', 'nativeExit', 'childStarted', 'childClosed', 'aborted'].sort(),
        );
        assert.equal(JSON.stringify(r).includes(canary), false);
        const ledger = readFileSync(join(f.directory, f.c.ledgerRelative), 'utf8');
        assert.equal(ledger.includes(canary), false);
        assert.equal(
          ledger
            .split('\n')
            .filter(Boolean)
            .map(JSON.parse)
            .filter((row) => row.event === 'project_get_intent').length,
          1,
        );
        await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
        assert.equal(f.cliCalls(), 1);
        assert.equal(existsSync(join(f.machine.localTemp, f.c.parentLockFilename)), false);
      },
      { mode },
    ),
  );

test('expired saved-file metadata consumes the fence but debits no GET and opens no CLI', () =>
  fixture(async (f) => {
    f.deps.readMetadata = async () => ({
      ...metadata(),
      status: 'saved_auth_expired',
      unexpired: false,
      covers75Minutes: false,
    });
    const r = await f.mod.runFoundationLiveProjectPreflight(f.deps);
    assert.equal(r.status, 'metadata_rejected');
    assert.equal(r.managementAttempts, 5);
    assert.equal(r.combinedAttempts, 206);
    assert.equal(r.getAttemptDebited, false);
    assert.equal(r.childTransportsClosed, true);
    assert.equal(f.cliCalls(), 0);
    await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
  }));

test('unknown physical CLI closure retains both mutex and once-fence without retry', () =>
  fixture(
    async (f) => {
      const r = await f.mod.runFoundationLiveProjectPreflight(f.deps);
      assert.equal(r.status, 'transport_rejected');
      assert.equal(r.childTransportsClosed, false);
      assert.equal(r.getAttemptDebited, true);
      assert.equal(existsSync(join(f.machine.localTemp, f.c.parentLockFilename)), true);
      await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
      assert.equal(f.cliCalls(), 1);
    },
    { mode: 'unclosed' },
  ));

test('drift, a live old root or a provision intent blocks before saved auth or the ledger', () =>
  fixture(async (f) => {
    assert.throws(() => f.mod.checkFoundationLiveProjectPreflight({ ...f.deps, processAlive: () => true }));
    f.put(f.c.ownerProvisionRelative, 'synthetic existing intent');
    await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
    rmSync(join(f.directory, f.c.ownerProvisionRelative));
    f.put(f.c.attemptRelative, canary);
    await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
    assert.equal(f.metadataCalls(), 0);
    assert.equal(f.cliCalls(), 0);
    assert.equal(existsSync(join(f.directory, f.c.ledgerRelative)), false);
  }));

test('post-GET finalization rejects a replacement mutex and emits only unknown outcome', () =>
  fixture(
    async (f) => {
      const chunks = [];
      const code = await f.mod.runFoundationLiveProjectPreflightCli({
        args: ['ReadProject'],
        dependencies: f.deps,
        output: { write: (text) => chunks.push(text) },
      });
      assert.equal(code, 1);
      assert.equal(f.cliCalls(), 1);
      const receipt = JSON.parse(chunks.join(''));
      assert.equal(receipt.kind, 'm03_project_preflight_unknown');
      assert.equal(Object.hasOwn(receipt, 'privateRead'), false);
      assert.equal(Object.hasOwn(receipt, 'networkRequests'), false);
      assert.equal(receipt.childTransportsClosed, false);
      assert.equal(readFileSync(join(f.machine.localTemp, f.c.parentLockFilename), 'utf8'), canary);
      assert.equal(JSON.stringify(receipt).includes(canary), false);
      await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
    },
    { mode: 'parent_replaced' },
  ));

test('a mutex changed during metadata blocks before the GET and preserves its replacement', () =>
  fixture(async (f) => {
    f.deps.readMetadata = async () => {
      const path = join(f.machine.localTemp, f.c.parentLockFilename);
      renameSync(path, path + '.owned');
      writeFileSync(path, canary, { flag: 'wx' });
      return metadata();
    };
    await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
    assert.equal(f.cliCalls(), 0);
    assert.equal(readFileSync(join(f.machine.localTemp, f.c.parentLockFilename), 'utf8'), canary);
    const ledger = readFileSync(join(f.directory, f.c.ledgerRelative), 'utf8');
    assert.equal(ledger.includes('project_get_intent'), false);
  }));

test('unclosed or malformed metadata cannot admit a GET or prove parent cleanup', async () => {
  for (const value of [
    { ...metadata(), childClosed: false },
    { ...metadata(), unexpected: canary },
  ])
    await fixture(async (f) => {
      f.deps.readMetadata = async () => value;
      const r = await f.mod.runFoundationLiveProjectPreflight(f.deps);
      assert.equal(r.status, 'metadata_rejected');
      assert.equal(r.getAttemptDebited, false);
      assert.equal(r.managementAttempts, 5);
      assert.equal(r.combinedAttempts, 206);
      assert.equal(r.childTransportsClosed, false);
      assert.equal(f.cliCalls(), 0);
      assert.equal(existsSync(join(f.machine.localTemp, f.c.parentLockFilename)), true);
      assert.equal(JSON.stringify(r).includes(canary), false);
      await assert.rejects(f.mod.runFoundationLiveProjectPreflight(f.deps));
    });
});
