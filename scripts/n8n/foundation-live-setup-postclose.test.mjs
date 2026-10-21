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
async function fixture(action) {
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
