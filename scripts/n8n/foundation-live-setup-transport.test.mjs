import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createFoundationLiveSetupCliTransport,
  assertFoundationLiveSetupTransport,
} from './foundation-live-setup-transport.mjs';
import {
  installFoundationSetupNoRetry,
  createFoundationSetupWireGuard,
  installFoundationSetupReadOnlyKeyring,
} from './foundation-live-setup-no-retry.mjs';

const project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const path = `/v10/projects/${project}/env?teamId=${team}`;
function fixture({
  mode = 'normal',
  wire = 'HTTP 200 OK\ncontent-type: application/json\n\n{"created":{}}\n',
} = {}) {
  const calls = [];
  let current, child;
  const transport = createFoundationLiveSetupCliTransport(
    {
      nodeExecutable: process.execPath,
      cliPath: resolve('synthetic-cli.js'),
      noRetryPreloadPath: resolve('synthetic-preload.mjs'),
      workingDirectory: resolve('.'),
      now: Date.now,
      deadlineAt: Date.now() + 60000,
      authorizeRequest: (s) => s === current,
    },
    {
      requestTimeoutMs: ['never_close', 'timeout'].includes(mode) ? 15 : 1000,
      closeGraceMs: 15,
      spawn(executable, args, options) {
        child = new EventEmitter();
        Object.assign(child, {
          stdin: new PassThrough(),
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          kill() {
            if (mode !== 'never_close') setImmediate(() => child.emit('close', 1));
          },
        });
        const call = { executable, args, options, input: '' };
        calls.push(call);
        child.stdin.on('data', (b) => (call.input += b));
        if (mode !== 'never_close' && mode !== 'timeout')
          setImmediate(() => {
            child.stdout.emit('data', Buffer.from(wire));
            child.emit('exit', 0);
            if (mode === 'delayed_close') setTimeout(() => child.emit('close', 0), 5);
            else child.emit('close', 0);
          });
        return child;
      },
    },
  );
  return {
    transport,
    calls,
    child: () => child,
    run(method = 'POST', route = path, body = { value: 'SYNTHETIC_SECRET_BODY_ONLY' }) {
      current = { method, path: route, body, signal: AbortSignal.timeout(1000) };
      return transport.request(current);
    },
  };
}
test('real CLI protocol puts private JSON only on stdin and waits for child close', async () => {
  const f = fixture({ mode: 'delayed_close' });
  assert.equal(assertFoundationLiveSetupTransport(f.transport), f.transport);
  const result = await f.run();
  assert.equal(result.status, 200);
  assert.equal(result.closed, true);
  const call = f.calls[0];
  assert.equal(call.args.includes('--include'), true);
  assert.equal(call.args.includes('--input'), true);
  assert.equal(call.args.includes('--scope'), false);
  assert.equal(call.options.env.EMR_FOUNDATION_SETUP_METHOD, 'POST');
  assert.equal(call.options.env.EMR_FOUNDATION_SETUP_PATH, path);
  assert.equal(JSON.stringify(call.args).includes('SYNTHETIC_SECRET'), false);
  assert.match(call.input, /SYNTHETIC_SECRET/);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, true);
  assert.equal(call.options.env.VERCEL_TELEMETRY_DISABLED, '1');
  assert.equal(call.options.env.NO_UPDATE_NOTIFIER, '1');
  assert.equal(call.options.env.NODE_OPTIONS, undefined);
  assert.deepEqual(f.transport.state(), {
    pendingRequests: 0,
    unclosedResponses: 0,
    closed: false,
    failed: false,
  });
});
test('wire guard permits one exact native global-fetch request and blocks auxiliary host/path/redirect replays', () => {
  const calls = [];
  const expected = { method: 'GET', path: '/v9/fixed?teamId=owned' };
  const guard = createFoundationSetupWireGuard(expected, (url, opts) => {
    calls.push({ url, opts });
    return 200;
  });
  assert.equal(guard('https://api.vercel.com' + expected.path), 200);
  assert.equal(calls[0].opts.redirect, 'manual');
  assert.throws(() => guard('https://api.vercel.com' + expected.path));
  assert.equal(calls.length, 1);
  for (const url of [
    'https://registry.npmjs.org/vercel',
    'https://api.vercel.com/v2/user',
    'https://sentry.io/api/error',
  ]) {
    const blocked = createFoundationSetupWireGuard(expected, () => {
      throw Error('NATIVE_MUST_NOT_RUN');
    });
    assert.throws(() => blocked(url), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
    assert.throws(
      () => blocked('https://api.vercel.com' + expected.path),
      /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/,
    );
  }
});
test('actual isolated preload wire fence blocks native http(s) request entrypoints without network', () => {
  const moduleUrl = new URL('./foundation-live-setup-no-retry.mjs', import.meta.url).href;
  const source = `import assert from 'node:assert/strict';
import http from 'node:http';import https from 'node:https';
import { request as importedRequest } from 'node:https';
import { installFoundationSetupWireFence } from ${JSON.stringify(moduleUrl)};
globalThis.fetch=async()=>({status:200});
installFoundationSetupWireFence({method:'GET',path:'/v9/fixed'});
// Pinned CLI's Sentry integration assigns wrappers during Client bootstrap.
http.get=()=>{throw Error('UNREVIEWED_WRAPPER_MUST_NEVER_RUN');};
https.request=()=>{throw Error('UNREVIEWED_WRAPPER_MUST_NEVER_RUN');};
for(const action of [()=>http.get('http://example.invalid'),()=>https.request('https://example.invalid'),()=>importedRequest('https://example.invalid')])assert.throws(action,/FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
assert.equal((await fetch('https://api.vercel.com/v9/fixed')).status,200);
assert.throws(()=>fetch('https://api.vercel.com/v9/fixed'),/FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
process.stdout.write('WIRE_FENCE_READY');`;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR },
    windowsHide: true,
    timeout: 5000,
    encoding: 'utf8',
  });
  assert.equal(result, 'WIRE_FENCE_READY');
});
test('HTTP errors remain HTTP errors despite native CLI raw exit0, and raw failures never escape', async () => {
  const f = fixture({
    wire: 'HTTP 403 Forbidden\ncontent-type: application/json\n\n{"error":"SYNTHETIC_PRIVATE_ERROR"}',
  });
  assert.equal((await f.run()).status, 403);
  for (const wire of [
    '{"secret":"SYNTHETIC_PRIVATE_ERROR"}',
    'HTTP 200 OK\n\n{',
    'HTTP 200 OK\n\n' + String.fromCharCode(0xff),
  ]) {
    const bad = fixture({ wire });
    await assert.rejects(bad.run(), (error) => error.message === 'FOUNDATION_LIVE_SETUP_TRANSPORT_BLOCKED');
  }
});
test('no external path, decrypt flag or unowned DELETE can start a CLI child', async () => {
  const f = fixture();
  for (const [method, route] of [
    ['GET', 'https://example.invalid'],
    ['GET', `/v10/projects/${project}/env?decrypt=true&teamId=${team}`],
    ['DELETE', `/v9/projects/foreign/env/known?teamId=${team}`],
    ['POST', '/v13/deployments?target=production'],
  ])
    await assert.rejects(f.run(method, route));
  assert.equal(f.calls.length, 0);
});
test('unknown child closure stays pending after bounded rejection and cannot authorize another request', async () => {
  const f = fixture({ mode: 'never_close' });
  await assert.rejects(f.run(), /FOUNDATION_LIVE_SETUP_TRANSPORT_BLOCKED/);
  assert.equal(f.transport.state().pendingRequests, 1);
  assert.equal(f.transport.state().unclosedResponses, 1);
  await assert.rejects(f.run());
  assert.equal(f.calls.length, 1);
  f.child().emit('close', 1);
  assert.equal(f.transport.state().pendingRequests, 0);
});
test('only the exact authorized DELETE invocation suppresses its native interactive confirmation', async () => {
  const f = fixture();
  await f.run('DELETE', `/v9/projects/${project}/env/ownedId?teamId=${team}`, undefined);
  assert.equal(f.calls[0].args.includes('--dangerously-skip-permissions'), true);
  const g = fixture();
  await g.run();
  assert.equal(g.calls[0].args.includes('--dangerously-skip-permissions'), false);
});
test('new child preload disables native default retry without changing installed globals', () => {
  class Client {
    fetch(url) {
      return { url, options: arguments[1] };
    }
  }
  installFoundationSetupNoRetry(Client, { method: 'GET', path: '/v9/fixed' });
  const r = new Client().fetch('/v9/fixed', { retry: { retries: 3 } });
  assert.deepEqual(r.options.retry, { retries: 0 });
  assert.equal(r.options.bailOn429, true);
  assert.equal(r.options.redirect, 'manual');
  assert.equal(r.options.useCurrentTeam, false);
  assert.throws(() => new Client().fetch('/v9/fixed'), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
});
test('native HTTP errors expose only a fixed numeric status and never the server error message', async () => {
  class Client {
    fetch(url) {
      assert.equal(url, '/v1/fixed');
      return Promise.reject(Object.assign(Error('SYNTHETIC_PRIVATE_SERVER_MESSAGE'), { status: 400 }));
    }
  }
  installFoundationSetupNoRetry(Client, { method: 'PATCH', path: '/v1/fixed' });
  await assert.rejects(
    new Client().fetch('/v1/fixed', { method: 'PATCH' }),
    (error) => error.message === 'FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:http_status_400',
  );
});
test('owned preload refuses hidden scope/auth calls before any native fetch and disables OAuth refresh', async () => {
  let calls = 0;
  class Client {
    fetch(url) {
      calls++;
      return url;
    }
  }
  installFoundationSetupNoRetry(Client, { method: 'GET', path: '/v9/fixed' });
  const client = new Client();
  assert.throws(() => client.fetch('/v2/user'), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
  assert.throws(() => client.fetch('/v9/fixed'), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
  assert.equal(calls, 0);
  client.authConfig = { token: 'SYNTHETIC', expiresAt: 1 };
  await assert.rejects(client.ensureAuthorized(), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
  client.authConfig.expiresAt = Date.now() / 1000 + 60;
  await client.ensureAuthorized();
  await assert.rejects(client.reauthenticate(), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
});

test('pinned Client constructor may assign its reauthenticate field but can never replace the owned refusal', async () => {
  let refreshes = 0;
  class Client {
    constructor() {
      this.reauthenticate = async () => {
        refreshes++;
      };
    }
    fetch(url) {
      return url;
    }
  }
  installFoundationSetupNoRetry(Client, { method: 'GET', path: '/v9/fixed' });
  const client = new Client();
  await assert.rejects(client.reauthenticate(), /FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED/);
  assert.equal(refreshes, 0);
  assert.equal(Object.getOwnPropertyDescriptor(client, 'reauthenticate').writable, false);
});
test('private auth expiry classifications distinguish invalid metadata from actually elapsed time', async () => {
  class Client {
    fetch(url) {
      return url;
    }
  }
  installFoundationSetupNoRetry(Client, { method: 'GET', path: '/v9/fixed' });
  const client = new Client();
  await assert.rejects(client.ensureAuthorized(), /:saved_auth_missing$/);
  for (const expiresAt of ['not-a-timestamp', NaN, Infinity, null]) {
    client.authConfig = { token: 'SYNTHETIC', expiresAt };
    await assert.rejects(client.ensureAuthorized(), /:saved_auth_invalid_expiry$/);
  }
  client.authConfig = { token: 'SYNTHETIC', expiresAt: 1 };
  await assert.rejects(client.ensureAuthorized(), /:saved_auth_expired$/);
});
test('read-only credentials adapter permits a keyring read and rejects both mutation paths before native calls', () => {
  let loader,
    reads = 0,
    writes = 0,
    deletes = 0;
  installFoundationSetupReadOnlyKeyring(
    {
      setLoadKeyringModuleForTesting(fn) {
        loader = fn;
      },
    },
    () => ({
      Entry: class {
        getPassword() {
          reads++;
          return 'SYNTHETIC_PRIVATE_CREDENTIAL';
        }
        setPassword() {
          writes++;
        }
        deleteCredential() {
          deletes++;
        }
      },
    }),
  );
  const entry = new (loader().Entry)('synthetic-service', 'synthetic-account');
  assert.equal(typeof entry.getPassword(), 'string');
  assert.throws(() => entry.setPassword('SYNTHETIC_NEW'), /:credential_storage_write_refused$/);
  assert.throws(() => entry.deleteCredential(), /:credential_storage_write_refused$/);
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  assert.equal(deletes, 0);
});
test('isolated read-only filesystem fence permits existing-directory checks and reads but zero persisted mutations', () => {
  const moduleUrl = new URL('./foundation-live-setup-no-retry.mjs', import.meta.url).href;
  const code = `import assert from 'node:assert/strict';import fs from 'node:fs';import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import{join}from'node:path';
import{installFoundationSetupReadOnlyFiles}from ${JSON.stringify(moduleUrl)};
const originalRm=rmSync;const root=mkdtempSync(join(tmpdir(),'emr-read-only-fence-'));const path=join(root,'synthetic-storage');writeFileSync(path,'SYNTHETIC_UNCHANGED');
try{installFoundationSetupReadOnlyFiles();fs.mkdirSync(root,{recursive:true});await fs.promises.mkdir(root,{recursive:true});
assert.equal(readFileSync(path,'utf8'),'SYNTHETIC_UNCHANGED');
for(const action of[()=>fs.writeFileSync(path,'new'),()=>fs.appendFileSync(path,'new'),()=>fs.openSync(path,'w'),()=>fs.unlinkSync(path),()=>fs.mkdirSync(join(root,'newdir'))])assert.throws(action);
await assert.rejects(fs.promises.writeFile(path,'new'));await assert.rejects(fs.promises.open(path,'w'));
assert.equal(readFileSync(path,'utf8'),'SYNTHETIC_UNCHANGED');}finally{originalRm(root,{recursive:true,force:true});}`;
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { stdio: 'pipe', timeout: 10000 });
});
