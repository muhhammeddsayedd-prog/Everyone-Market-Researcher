import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createFoundationRuntimePlan } from './foundation-runtime-plan.mjs';
import {
  createFoundationLiveManagementTransport,
  createFoundationLiveProviderReader,
  createFoundationLiveGatewayProbe,
} from './foundation-live-runtime-transport.mjs';

function plan() {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const transport = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const records = Object.keys(bindings.workflowRefs).map((k) =>
    JSON.parse(readFileSync(new URL('../../n8n/workflows/' + k + '.json', import.meta.url))),
  );
  return createFoundationRuntimePlan({
    bindings,
    transport,
    records,
    setup: {
      version: 1,
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
      sourceCommitSha: 'a'.repeat(40),
      deploymentId: 'dpl_SyntheticRuntimeTransport',
      audience: 'https://everyone-market-researcher-synthetic-transport.vercel.app',
      environment: 'preview',
      readyState: 'READY',
      protection: 'all_except_custom_domains',
      protectionVerified: true,
      protectionTransportVerified: true,
      sqlAudienceBindingVerified: true,
    },
  });
}
const p = plan();
function fixture({
  value = { ok: true },
  rawBody,
  headers = {},
  closeSocket = true,
  dns,
  create,
  status = 200,
} = {}) {
  const options = [],
    writes = [];
  let socket,
    socketDestroys = 0;
  const dependencies = {
    timeoutMs: 50,
    closeTimeoutMs: 5,
    resolveInstance: dns ?? (async () => [{ address: '1.1.1.1', family: 4 }]),
    request(o, callback) {
      options.push(o);
      const req = new EventEmitter();
      socket = new EventEmitter();
      socket.authorized = true;
      socket.remoteAddress = '1.1.1.1';
      socket.remoteFamily = 'IPv4';
      socket.destroy = () => {
        socketDestroys++;
        if (closeSocket) socket.emit('close');
      };
      req.destroy = () => req.emit('close');
      req.write = (b) => {
        writes.push(String(b));
      };
      req.end = () =>
        setImmediate(() => {
          req.emit('socket', socket);
          socket.emit('secureConnect');
          const bytes =
            rawBody ?? Buffer.from(JSON.stringify(typeof value === 'function' ? value(o) : value));
          const res = new EventEmitter();
          res.statusCode = typeof status === 'function' ? status(o) : status;
          res.complete = true;
          res.headers = {
            'content-type': 'application/json',
            'content-length': String(bytes.length),
            ...headers,
          };
          res.rawHeaders = Object.entries(res.headers).flat();
          res.destroy = () => res.emit('close');
          callback(res);
          res.emit('data', bytes);
          res.emit('end');
          res.emit('close');
          req.emit('close');
          if (closeSocket) socket.emit('close');
        });
      return req;
    },
  };
  const t = create
    ? create(dependencies)
    : createFoundationLiveManagementTransport(
        {
          plan: p,
          apiKey: 'SYNTHETIC_PRIVATE_MANAGEMENT_KEY',
          sensitiveValues: ['SYNTHETIC_PRIVATE_MACHINE'],
          deadlineAt: Date.now() + 60000,
        },
        dependencies,
      );
  return { t, options, writes, socket: () => socket, destroys: () => socketDestroys };
}
const path = '/api/v1/workflows/' + p.baseline[0].id + '?excludePinnedData=true';

test('runtime management transport pins TLS/public DNS and exposes only complete private JSON', async () => {
  const f = fixture();
  assert.deepEqual(await f.t.send('GET', path), { status: 200, body: { ok: true } });
  const o = f.options[0];
  assert.equal(o.hostname, 'muhhammedsayed.app.n8n.cloud');
  assert.equal(o.rejectUnauthorized, true);
  assert.equal(o.agent, false);
  assert.equal(o.minVersion, 'TLSv1.2');
  assert.equal(o.headers['accept-encoding'], 'identity');
  assert.deepEqual(f.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
  f.t.close();
});

test('unowned/actor paths and private or mixed DNS fail before HTTPS', async () => {
  const f = fixture();
  await assert.rejects(f.t.send('POST', '/api/v1/workflows'), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
  assert.equal(f.options.length, 0);
  f.t.close();
  for (const rows of [
    [{ address: '127.0.0.1', family: 4 }],
    [
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
  ]) {
    const g = fixture({ dns: async () => rows });
    await assert.rejects(g.t.send('GET', path), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
    assert.equal(g.options.length, 0);
    g.t.close();
  }
});

test('oversize, ambiguous framing, invalid UTF8 and private reflection are fixed refusals', async () => {
  for (const config of [
    { headers: { 'content-length': '524289' } },
    { headers: { 'transfer-encoding': 'chunked' } },
    { rawBody: Buffer.from([0xff]) },
    { value: { error: 'SYNTHETIC_PRIVATE_MANAGEMENT_KEY' } },
  ]) {
    const f = fixture(config);
    await assert.rejects(f.t.send('GET', path), (e) => e.message === 'FOUNDATION_LIVE_MANAGEMENT_BLOCKED');
    f.t.close();
  }
});

test('physical-close timeout destroys and retains unresolved socket ownership until actual close', async () => {
  const f = fixture({ closeSocket: false });
  await assert.rejects(f.t.send('GET', path), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
  assert.ok(f.destroys() > 0);
  assert.deepEqual(f.t.state(), { pendingRequests: 1, unclosedResponses: 1 });
  const before = f.destroys();
  f.t.close();
  assert.ok(f.destroys() > before);
  f.socket().emit('close');
  assert.deepEqual(f.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
});

test('a resolver ignoring abort stays owned after bounded refusal until it actually settles', async () => {
  let finish;
  const f = fixture({
    dns: () =>
      new Promise((done) => {
        finish = done;
      }),
  });
  const result = f.t.send('GET', path).then(
    () => 'pass',
    () => 'refused',
  );
  await new Promise((done) => setTimeout(done, 70));
  const bounded = await Promise.race([result, Promise.resolve('still_pending')]);
  assert.equal(bounded, 'refused');
  assert.equal(f.t.state().pendingRequests, 1);
  finish([{ address: '1.1.1.1', family: 4 }]);
  await new Promise((done) => setImmediate(done));
  assert.equal(f.t.state().pendingRequests, 0);
  assert.equal(f.options.length, 0);
  f.t.close();
});

test('provider reader admits before only fixed authenticated run GET and enforces64KiB before body acceptance', async () => {
  let attempts = 0;
  const create = (d) =>
    createFoundationLiveProviderReader(
      {
        token: 'SYNTHETIC_APIFY_READ_ONLY',
        deadlineAt: Date.now() + 60000,
        admitProviderAttempt() {
          attempts++;
        },
      },
      d,
    );
  const f = fixture({ create, value: { data: { id: 'OriginalRun' } } });
  const r = await f.t.read({ apifyRunId: 'OriginalRun' });
  assert.equal(attempts, 1);
  assert.equal(f.options[0].hostname, 'api.apify.com');
  assert.equal(f.options[0].path, '/v2/actor-runs/OriginalRun');
  assert.equal(f.options[0].method, 'GET');
  assert.equal(f.options[0].headers.Authorization, 'Bearer SYNTHETIC_APIFY_READ_ONLY');
  assert.equal(f.options[0].headers['X-N8N-API-KEY'], undefined);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(r.transport, { requests: 1, retries: 0, socketsClosed: true, runBytesMax: 65536 });
  await assert.rejects(f.t.read({ apifyRunId: '../acts/start' }), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
  assert.equal(attempts, 1);
  assert.equal(f.options.length, 1);
  f.t.close();
  const large = fixture({ create, headers: { 'content-length': '65537' } });
  await assert.rejects(large.t.read({ apifyRunId: 'OriginalRun' }), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
  large.t.close();
});

test('gateway probes correlate durable request IDs and never send Machine auth on denial probe', async () => {
  const admissions = [];
  const audience = 'https://everyone-market-researcher-synthetic-wire-probe.vercel.app';
  const f = fixture({
    status: (o) => (o.headers.Authorization ? 200 : 401),
    create: (d) =>
      createFoundationLiveGatewayProbe(
        {
          audience,
          machineToken: 'M'.repeat(43),
          protectionBypass: 'B'.repeat(32),
          deadlineAt: Date.now() + 60000,
          admitGatewayAttempt: (r) => {
            admissions.push(r);
          },
        },
        d,
      ),
  });
  assert.equal((await f.t.identity()).status, 200);
  assert.equal((await f.t.identity({ unauthorized: true })).status, 401);
  assert.equal(admissions.length, 2);
  assert.equal(new Set(admissions.map((a) => a.requestId)).size, 2);
  for (let i = 0; i < 2; i++) {
    assert.equal(f.options[i].hostname, new URL(audience).host);
    assert.equal(f.options[i].path, '/api/internal/n8n/foundation');
    assert.equal(f.options[i].headers['x-vercel-protection-bypass'], 'B'.repeat(32));
    assert.equal(f.options[i].headers['X-N8N-API-KEY'], undefined);
    assert.deepEqual(JSON.parse(f.writes[i]), {
      version: 1,
      requestId: admissions[i].requestId,
      operation: 'identity.read',
      args: {},
    });
  }
  assert.equal(f.options[0].headers.Authorization, 'Bearer ' + 'M'.repeat(43));
  assert.equal(f.options[1].headers.Authorization, undefined);
  assert.deepEqual(f.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
  f.t.close();
});
