import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const source = new URL('./', import.meta.url);
async function fixture(action, { afterLogin = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-postclose-get-'));
  const old = Object.fromEntries(['LOCALAPPDATA', 'APPDATA'].map((k) => [k, process.env[k]]));
  const put = (p, t) => {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, t);
  };
  try {
    for (const name of [
      'foundation-live-setup-postclose.mjs',
      'foundation-live-setup-diagnostic.mjs',
      'foundation-live-setup-transport.mjs',
      'foundation-live-setup-no-retry.mjs',
    ]) {
      const destination = join(directory, 'scripts/n8n', name);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(new URL(name, source), destination);
    }
    const mod = await import(
      pathToFileURL(join(directory, 'scripts/n8n/foundation-live-setup-postclose.mjs')).href
    );
    const c = mod.foundationPostcloseProjectRead;
    for (const rel of [c.attemptRelative, c.cleanupRelative])
      put(join(directory, rel), readFileSync(new URL('../../' + rel, source)));
    process.env.LOCALAPPDATA = join(directory, 'local');
    process.env.APPDATA = join(directory, 'roaming');
    mkdirSync(join(process.env.LOCALAPPDATA, 'Temp'), { recursive: true });
    put(join(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js'), '// synthetic never executed\n');
    const live = join(directory, 'scripts/n8n/out/foundation/live');
    const management =
      JSON.stringify({
        event: 'management_header',
        version: 1,
        sourceCommitSha: c.sourceCommitSha,
        deadlineAt: c.originalDeadlineAt,
      }) +
      '\n' +
      JSON.stringify({ event: 'management_attempt', ordinal: 1 }) +
      '\n';
    put(join(live, 'management.jsonl'), management);
    const attempt = JSON.parse(readFileSync(join(directory, c.attemptRelative), 'utf8'));
    put(join(live, 'setup.jsonl'), JSON.stringify(attempt.setup.row) + '\n');
    put(
      join(live, 'control.jsonl'),
      Array.from({ length: 100 }, (_, i) =>
        JSON.stringify({
          event: 'control_request_intent',
          ordinal: i + 1,
          kind: 'discovery',
          at: 1,
          workflowId: 'synthetic',
        }),
      ).join('\n') + '\n',
    );
    if (afterLogin) {
      put(
        join(directory, mod.foundationPostloginProjectRead.expiredReadRelative),
        readFileSync(new URL('../../' + mod.foundationPostloginProjectRead.expiredReadRelative, source)),
      );
      // Exact public technical ledger from the physically closed expired read;
      // source SHA64312647…19142f5. This fixture contains no auth/raw DTO data.
      put(
        join(directory, c.ledgerRelative),
        readFileSync(new URL('./fixtures/foundation-vercel-postclose-expired-ledger.jsonl', source)),
      );
    }
    let calls = 0;
    const dto = {
      id: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      accountId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
      rootDirectory: 'apps/web',
      nodeVersion: '24.x',
      framework: 'nextjs',
      link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
      ssoProtection: { deploymentType: 'all_except_custom_domains' },
      protectionBypass: {},
      neverReflect: 'SYNTHETIC_PRIVATE_BODY',
    };
    const input = {
      processAlive: () => false,
      transportDependencies: {
        spawn(exe, args, options) {
          calls++;
          assert.equal(args.includes('GET'), true);
          assert.equal(args.includes('--input'), false);
          assert.equal(
            options.env.EMR_FOUNDATION_SETUP_PATH,
            '/v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1',
          );
          const child = new EventEmitter();
          Object.assign(child, {
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            stderr: new PassThrough(),
            kill() {},
          });
          setImmediate(() => {
            child.emit('spawn');
            child.stdout.write(
              'HTTP 200 Synthetic\ncontent-type: application/json\n\n' + JSON.stringify(dto),
            );
            child.emit('close', 0);
          });
          return child;
        },
      },
    };
    await action({ mod, c, directory, live, management, input, calls: () => calls });
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
test('post-close entry one-use GET preserves old journals and conservatively records all three attempts', () =>
  fixture(async (f) => {
    assert.equal(f.mod.checkFoundationPostcloseProjectRead(f.input).networkRequests, 0);
    assert.equal(f.calls(), 0);
    const result = await f.mod.runFoundationPostcloseProjectRead(f.input);
    assert.equal(result.status, 'project_contract_ready');
    assert.equal(result.aggregateAttempts, 3);
    assert.equal(result.childTransportsClosed, true);
    assert.equal(result.newAcceptanceWindow, false);
    assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE_BODY'), false);
    assert.equal(f.calls(), 1);
    assert.equal(readFileSync(join(f.live, 'management.jsonl'), 'utf8'), f.management);
    assert.equal(readFileSync(join(f.live, 'control.jsonl'), 'utf8').trim().split('\n').length, 100);
    const ledger = readFileSync(join(f.directory, f.c.ledgerRelative), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(ledger[0].priorBatchAttempts, 1);
    assert.equal(ledger[0].priorMcpAttempts, 1);
    assert.equal(ledger[0].thisAttempt, 1);
    assert.equal(ledger.length, 4);
    assert.equal(existsSync(join(process.env.LOCALAPPDATA, 'Temp', f.c.parentLockFilename)), false);
    await assert.rejects(f.mod.runFoundationPostcloseProjectRead(f.input));
    assert.equal(f.calls(), 1);
  }));
test('post-close changed counts, live PID or shared lock block before every child', () =>
  fixture(async (f) => {
    assert.throws(() => f.mod.checkFoundationPostcloseProjectRead({ ...f.input, processAlive: () => true }));
    const lock = join(process.env.LOCALAPPDATA, 'Temp', f.c.parentLockFilename);
    writeFileSync(lock, 'synthetic live owner');
    await assert.rejects(f.mod.runFoundationPostcloseProjectRead(f.input));
    rmSync(lock);
    writeFileSync(
      join(f.live, 'management.jsonl'),
      f.management + JSON.stringify({ event: 'management_attempt', ordinal: 2 }) + '\n',
    );
    await assert.rejects(f.mod.runFoundationPostcloseProjectRead(f.input));
    assert.equal(f.calls(), 0);
  }));
test('unknown response retains durable one-use fence after physical child closure', () =>
  fixture(async (f) => {
    f.input.transportDependencies.spawn = () => {
      const child = new EventEmitter();
      Object.assign(child, {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill() {},
      });
      setImmediate(() => {
        child.emit('spawn');
        child.stderr.write('SYNTHETIC_PRIVATE_ERROR ENOTFOUND');
        child.emit('close', 1);
      });
      return child;
    };
    const r = await f.mod.runFoundationPostcloseProjectRead(f.input);
    assert.equal(r.status, 'transport_rejected');
    assert.equal(r.transport.code, 'dns_failure');
    assert.equal(r.childTransportsClosed, true);
    assert.equal(JSON.stringify(r).includes('SYNTHETIC_PRIVATE_ERROR'), false);
    await assert.rejects(f.mod.runFoundationPostcloseProjectRead(f.input));
  }));
test('after-login mode pins expired read and gets exactly one new GET without reopening the old mode or journals', () =>
  fixture(
    async (f) => {
      const p = f.mod.foundationPostloginProjectRead;
      const oldLedger = readFileSync(join(f.directory, f.c.ledgerRelative), 'utf8');
      assert.throws(() => f.mod.checkFoundationPostcloseProjectRead(f.input));
      await assert.rejects(f.mod.runFoundationPostcloseProjectRead(f.input));
      const check = f.mod.checkFoundationPostloginProjectRead(f.input);
      assert.equal(check.kind, 'postlogin_project_read_ready');
      assert.equal(check.aggregateAttempts, 4);
      assert.equal(check.networkRequests, 0);
      const result = await f.mod.runFoundationPostloginProjectRead(f.input);
      assert.equal(result.kind, 'postlogin_project_read_result');
      assert.equal(result.aggregateAttempts, 4);
      assert.equal(result.status, 'project_contract_ready');
      assert.equal(result.childTransportsClosed, true);
      assert.equal(result.newAcceptanceWindow, false);
      assert.equal(result.mutations, 0);
      assert.equal(f.calls(), 1);
      assert.equal(readFileSync(join(f.directory, f.c.ledgerRelative), 'utf8'), oldLedger);
      assert.equal(readFileSync(join(f.live, 'management.jsonl'), 'utf8'), f.management);
      assert.equal(readFileSync(join(f.live, 'control.jsonl'), 'utf8').trim().split('\n').length, 100);
      const ledger = readFileSync(join(f.directory, p.ledgerRelative), 'utf8')
        .trim()
        .split('\n')
        .map(JSON.parse);
      assert.equal(ledger.length, 4);
      assert.equal(ledger[0].priorExpiredReadAttempts, 1);
      assert.equal(ledger[0].aggregateAttempts, 4);
      await assert.rejects(f.mod.runFoundationPostloginProjectRead(f.input));
      assert.equal(f.calls(), 1);
    },
    { afterLogin: true },
  ));
test('after-login mode refuses changed expired ledger or expired-result artifact before any child', () =>
  fixture(
    async (f) => {
      const old = join(f.directory, f.c.ledgerRelative),
        bytes = readFileSync(old);
      writeFileSync(old, Buffer.concat([bytes, Buffer.from('\n')]));
      await assert.rejects(f.mod.runFoundationPostloginProjectRead(f.input));
      writeFileSync(old, bytes);
      const record = join(f.directory, f.mod.foundationPostloginProjectRead.expiredReadRelative);
      writeFileSync(record, readFileSync(record, 'utf8').replace('saved_auth_expired', 'unknown'));
      await assert.rejects(f.mod.runFoundationPostloginProjectRead(f.input));
      assert.equal(f.calls(), 0);
    },
    { afterLogin: true },
  ));
test('after-login unknown physical closure retains the shared lock and one-use intent, never another GET', () =>
  fixture(
    async (f) => {
      let calls = 0;
      f.input.transportDependencies = {
        requestTimeoutMs: 5,
        closeGraceMs: 5,
        spawn() {
          calls++;
          const child = new EventEmitter();
          Object.assign(child, {
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            stderr: new PassThrough(),
            kill() {},
          });
          setImmediate(() => child.emit('spawn'));
          return child;
        },
      };
      const result = await f.mod.runFoundationPostloginProjectRead(f.input);
      assert.equal(result.status, 'transport_rejected');
      assert.equal(result.childTransportsClosed, false);
      assert.equal(result.transport.childClosed, false);
      assert.equal(result.aggregateAttempts, 4);
      assert.equal(existsSync(join(f.directory, f.mod.foundationPostloginProjectRead.ledgerRelative)), true);
      assert.equal(existsSync(join(process.env.LOCALAPPDATA, 'Temp', f.c.parentLockFilename)), true);
      await assert.rejects(f.mod.runFoundationPostloginProjectRead(f.input));
      assert.equal(calls, 1);
    },
    { afterLogin: true },
  ));
