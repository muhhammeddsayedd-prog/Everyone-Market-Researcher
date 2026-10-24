import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createFoundationNativeTransport } from './foundation-native-transport.mjs';
import * as nativeTransport from './foundation-native-transport.mjs';
import { createFoundationCallbackCases } from './foundation-callback-cases.mjs';

const bindings = JSON.parse(readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)));
const workflowId = bindings.workflowRefs['WF-00'].id;
const key = 'SYNTHETIC_PRIVATE_KEY_ONLY';
const workflowPath = '/api/v1/workflows/' + workflowId + '?excludePinnedData=true';
const executionPath = '/api/v1/executions/123?includeData=true';
const fixed = /^Error: FOUNDATION_NATIVE_TRANSPORT_[A-Z_]+$/;
function fixture({
  headers = {},
  chunks = [Buffer.from('{}')],
  complete = true,
  socketDelay = 0,
  neverClose = false,
  rawHeaders,
  addresses = [{ address: '1.1.1.1', family: 4 }],
  auth = () => true,
  bodyError = false,
  timeoutMs = 1000,
  statusCode = 200,
  tlsAuthorized = true,
  remoteAddress = '1.1.1.1',
} = {}) {
  const calls = [],
    sockets = [],
    requestBodies = [];
  let dnsCalls = 0;
  const transport = createFoundationNativeTransport(
    { apiKey: key, bindings, authorizeExecution: auth },
    {
      timeoutMs,
      closeTimeoutMs: 80,
      resolveInstance: async () => {
        dnsCalls++;
        return addresses;
      },
      request(options, callback) {
        calls.push(options);
        const req = new EventEmitter(),
          socket = new EventEmitter();
        sockets.push(socket);
        socket.encrypted = true;
        socket.authorized = tlsAuthorized;
        socket.remoteAddress = remoteAddress;
        let res,
          closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          res?.destroy();
          req.emit('close');
          if (!neverClose) setTimeout(() => socket.emit('close'), socketDelay);
        };
        req.destroy = close;
        socket.destroyCalls = 0;
        socket.destroy = () => {
          socket.destroyCalls++;
          close();
        };
        req.end = (body) => {
          requestBodies.push(body);
          return queueMicrotask(() => {
            req.emit('socket', socket);
            socket.emit('secureConnect');
            res = new PassThrough();
            res.statusCode = statusCode;
            res.headers = headers;
            res.rawHeaders = rawHeaders ?? Object.entries(headers).flat();
            res.complete = complete;
            callback(res);
            if (bodyError) {
              res.emit('error', Error('SYNTHETIC_PRIVATE_ERROR_' + key));
              close();
              return;
            }
            for (const chunk of chunks) {
              if (!res.destroyed) res.write(chunk);
            }
            if (!res.destroyed) res.end();
            res.once('end', close);
          });
        };
        return req;
      },
    },
  );
  return { transport, calls, sockets, requestBodies, dnsCalls: () => dnsCalls };
}
async function consume(response) {
  const chunks = [];
  for await (const chunk of response.body) chunks.push(chunk);
  await response.closed;
  return Buffer.concat(chunks).toString('utf8');
}

test('native transport error projection accepts only its private branded fixed codes without property reads', async () => {
  const f = fixture();
  const error = await f.transport.request({ method: 'GET', path: '/api/v1/variables' }).catch((e) => e);
  assert.equal(typeof nativeTransport.foundationNativeTransportErrorCode, 'function');
  assert.equal(nativeTransport.foundationNativeTransportErrorCode(error), 'REQUEST');
  let reads = 0;
  const raw = Object.create(null);
  for (const name of ['message', 'code', 'body'])
    Object.defineProperty(raw, name, {
      get() {
        reads++;
        throw Error('SYNTHETIC_PRIVATE_ERROR');
      },
    });
  const proxy = new Proxy(
    {},
    {
      get() {
        reads++;
        throw Error('SYNTHETIC_PRIVATE_ERROR');
      },
    },
  );
  for (const value of [
    raw,
    proxy,
    new Error('FOUNDATION_NATIVE_TRANSPORT_REQUEST'),
    Object.create(error),
    null,
    1,
    'REQUEST',
  ])
    assert.equal(nativeTransport.foundationNativeTransportErrorCode(value), null);
  assert.equal(reads, 0);
  assert.equal(f.dnsCalls(), 0);
  f.transport.close();
});

test('native framing rejection does not inspect an arbitrary thrown error message', async () => {
  let reads = 0;
  const raw = Object.create(null);
  Object.defineProperty(raw, 'message', {
    get() {
      reads++;
      throw Error('SYNTHETIC_PRIVATE_ERROR');
    },
  });
  const headers = {};
  Object.defineProperty(headers, 'content-type', {
    enumerable: true,
    get() {
      throw raw;
    },
  });
  const f = fixture({ headers, rawHeaders: [] });
  const error = await f.transport.request({ method: 'GET', path: workflowPath }).catch((e) => e);
  assert.equal(nativeTransport.foundationNativeTransportErrorCode(error), 'FRAMING');
  assert.equal(reads, 0);
  f.transport.close();
});

test('fixed private host uses pinned public DNS, strict TLS and an isolated socket', async () => {
  const f = fixture({ headers: { 'content-length': '2', 'content-type': 'application/json' } });
  const r = await f.transport.request({ method: 'GET', path: workflowPath });
  assert.equal(await consume(r), '{}');
  const o = f.calls[0];
  assert.equal(o.hostname, 'muhhammedsayed.app.n8n.cloud');
  assert.equal(o.servername, o.hostname);
  assert.equal(o.rejectUnauthorized, true);
  assert.equal(o.agent, false);
  assert.equal(o.minVersion, 'TLSv1.2');
  assert.equal(o.headers['X-N8N-API-KEY'], key);
  assert.equal(o.headers['accept-encoding'], 'identity');
  assert.equal(Object.keys(f.transport).includes('apiKey'), false);
  await new Promise((resolve, reject) =>
    o.lookup(o.hostname, {}, (e, a, family) => {
      if (e) return reject(e);
      assert.equal(a, '1.1.1.1');
      assert.equal(family, 4);
      resolve();
    }),
  );
  f.transport.close();
  await assert.rejects(f.transport.request({ method: 'GET', path: workflowPath }), fixed);
});

test('only exact owned routes and synchronous registered execution authorization pass before DNS', async () => {
  const allowed = [
    ['GET', executionPath],
    ['GET', '/api/v1/executions/123?includeData=false'],
    ['DELETE', '/api/v1/executions/123'],
    ['POST', '/api/v1/executions/123/stop'],
    ['GET', '/api/v1/executions?workflowId=' + workflowId + '&includeData=false&limit=120'],
    [
      'GET',
      '/api/v1/executions?workflowId=' +
        workflowId +
        '&includeData=false&limit=120&status=running&cursor=a%2Bb',
    ],
  ];
  for (const [method, path] of allowed) {
    const f = fixture();
    await consume(await f.transport.request({ method, path }));
    assert.equal(f.calls.length, 1);
    f.transport.close();
  }
  const f = fixture({ auth: () => false });
  for (const [method, path] of [
    ['GET', executionPath],
    ['DELETE', '/api/v1/executions/123'],
    ['GET', 'https://other.invalid/api/v1/executions/123'],
    ['GET', '/api/v1/variables'],
    ['GET', '/api/v1/workflows/foreign?excludePinnedData=true'],
    ['POST', '/api/v1/workflows/' + workflowId + '/publish'],
    ['GET', '/api/v1/executions?includeData=false&limit=120'],
    ['GET', '/api/v1/executions?workflowId=' + workflowId + '&includeData=true&limit=120'],
    ['GET', '/api/v1/executions?workflowId=' + workflowId + '&includeData=false&limit=120&status=success'],
    ['GET', '/api/v1/executions?workflowId=' + workflowId + '&includeData=false&limit=120&cursor=%0A'],
    ['GET', '/api/v1/executions/0?includeData=true'],
    ['GET', executionPath + '&includeData=false'],
  ])
    await assert.rejects(f.transport.request({ method, path }), fixed);
  assert.equal(f.dnsCalls(), 0);
  assert.equal(f.calls.length, 0);
  const asyncAuth = fixture({ auth: async () => true });
  await assert.rejects(asyncAuth.transport.request({ method: 'GET', path: executionPath }), fixed);
  assert.equal(asyncAuth.dnsCalls(), 0);
});

test('mixed public/private DNS and a pre-aborted signal never launch HTTPS', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '2001:db8::1']) {
    const f = fixture({
      addresses: [
        { address: '1.1.1.1', family: 4 },
        { address, family: address.includes(':') ? 6 : 4 },
      ],
    });
    await assert.rejects(f.transport.request({ method: 'GET', path: workflowPath }), fixed);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    f.transport.request({ method: 'GET', path: workflowPath, signal: controller.signal }),
    fixed,
  );
  assert.equal(f.dnsCalls(), 0);
});

test('framing and declared oversized responses are refused before exposing a body', async () => {
  for (const headers of [
    { 'content-length': String(8 * 1024 * 1024 + 1) },
    { 'content-length': '02' },
    { 'content-encoding': 'gzip' },
    { 'content-length': '2', 'transfer-encoding': 'chunked' },
    { 'transfer-encoding': 'identity' },
    { 'content-type': 'text/html' },
  ]) {
    const f = fixture({ headers });
    await assert.rejects(f.transport.request({ method: 'GET', path: workflowPath }), fixed);
    assert.equal(f.calls.length, 1);
  }
  const f = fixture({
    headers: { 'content-length': '2' },
    rawHeaders: ['Content-Length', '2', 'content-length', '2'],
  });
  await assert.rejects(f.transport.request({ method: 'GET', path: workflowPath }), fixed);
});

test('stream limit refuses the oversized prefix without returning that chunk', async () => {
  const f = fixture({ chunks: [Buffer.alloc(8 * 1024 * 1024 + 1)] });
  const r = await f.transport.request({ method: 'GET', path: workflowPath });
  let bytes = 0;
  await assert.rejects(
    (async () => {
      for await (const chunk of r.body) bytes += chunk.length;
      await r.closed;
    })(),
    fixed,
  );
  assert.equal(bytes, 0);
  await assert.rejects(r.closed, fixed);
});

test('truncation, length mismatch and raw native errors cannot produce a success or reveal private details', async () => {
  for (const options of [{ complete: false }, { headers: { 'content-length': '3' } }, { bodyError: true }]) {
    const f = fixture(options);
    let error;
    try {
      await consume(await f.transport.request({ method: 'GET', path: workflowPath }));
    } catch (e) {
      error = e;
    }
    assert.match(String(error), fixed);
    assert.equal(String(error).includes(key), false);
    assert.equal(String(error).includes('SYNTHETIC_PRIVATE_ERROR'), false);
    assert.equal(f.calls.length, 1);
  }
});

test('closed waits for physical socket closure and refuses a never-closing socket', async () => {
  const f = fixture({ socketDelay: 30 });
  const r = await f.transport.request({ method: 'GET', path: workflowPath });
  let closed = false;
  r.closed.then(
    () => {
      closed = true;
    },
    () => {},
  );
  for await (const _chunk of r.body) void _chunk;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(closed, false);
  await r.closed;
  assert.equal(closed, true);
  const g = fixture({ neverClose: true });
  await assert.rejects(consume(await g.transport.request({ method: 'GET', path: workflowPath })), fixed);
  assert.equal(g.sockets[0].destroyCalls > 0, true);
  assert.deepEqual(g.transport.state(), { pendingRequests: 1, unclosedResponses: 1 });
  const attempts = g.sockets[0].destroyCalls;
  g.transport.close();
  assert.equal(g.sockets[0].destroyCalls > attempts, true);
  assert.deepEqual(g.transport.state(), { pendingRequests: 1, unclosedResponses: 1 });
  g.sockets[0].emit('close');
  assert.deepEqual(g.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
});

test('four-error wire operation accepts only a valid standard trace and sends no management authentication', async () => {
  const traceparent = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
  const f = fixture();
  await consume(await f.transport.webhookError({ traceparent }));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].path, '/webhook/emr-apify-callback');
  assert.deepEqual(f.calls[0].headers, { 'content-type': 'application/json', traceparent });
  assert.deepEqual(f.requestBodies, ['{}']);
  assert.equal(JSON.stringify(f.calls[0].headers).includes(key), false);
  await assert.rejects(f.transport.request({ method: 'POST', path: '/webhook/emr-apify-callback' }), fixed);
  const requests = f.calls.length;
  for (const value of [
    '',
    traceparent + '\n',
    '00-' + '0'.repeat(32) + '-' + 'b'.repeat(16) + '-01',
    '00-' + 'a'.repeat(32) + '-' + '0'.repeat(16) + '-01',
    traceparent.toUpperCase(),
  ])
    await assert.rejects(f.transport.webhookError({ traceparent: value }), fixed);
  await assert.rejects(f.transport.webhookError({ traceparent, path: '/other' }), fixed);
  assert.equal(f.calls.length, requests);
});

test('redirects, unauthorized TLS and remote address drift fail without retrying', async () => {
  for (const options of [{ statusCode: 302 }, { tlsAuthorized: false }, { remoteAddress: '10.0.0.1' }]) {
    const f = fixture(options);
    await assert.rejects(f.transport.request({ method: 'GET', path: workflowPath }), fixed);
    assert.equal(f.calls.length, 1);
  }
});

test('mid-response abort and close during unresolved DNS stop the bounded exchange', async () => {
  const f = fixture({ socketDelay: 30 }),
    signal = new AbortController();
  const r = await f.transport.request({ method: 'GET', path: workflowPath, signal: signal.signal });
  signal.abort();
  await assert.rejects(consume(r), fixed);
  await assert.rejects(r.closed, fixed);
  let starts = 0;
  const transport = createFoundationNativeTransport(
    { apiKey: key, bindings, authorizeExecution: () => true },
    {
      timeoutMs: 100,
      closeTimeoutMs: 10,
      resolveInstance: () => new Promise(() => {}),
      request: () => {
        starts++;
        throw Error('SYNTHETIC_PRIVATE_' + key);
      },
    },
  );
  const pending = transport.request({ method: 'GET', path: workflowPath });
  transport.close();
  await assert.rejects(pending, fixed);
  assert.equal(starts, 0);
});

test('callback wire operation accepts a one-shot producer brand only and sends no management key', async () => {
  const now = Date.now(),
    producer = createFoundationCallbackCases({
      now: Date.now,
      deadlineAt: now + 60000,
      readUnknown: async () => ({
        apify_run_id: 'M03AcceptanceUnknown0001',
        registry_absent: true,
        launch_absent: true,
        observed_at: new Date().toISOString(),
      }),
    });
  const wireCase = await producer.prepare({ caseId: 'callback.unknown' }),
    f = fixture();
  await assert.rejects(f.transport.callbackCase({ wireCase: structuredClone(wireCase) }), fixed);
  assert.equal(f.dnsCalls(), 0);
  await consume(await f.transport.callbackCase({ wireCase }));
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].headers, {
    'content-type': 'application/json',
    traceparent: wireCase.traceparent,
  });
  assert.deepEqual(f.requestBodies, [JSON.stringify(wireCase.body)]);
  await assert.rejects(f.transport.callbackCase({ wireCase }), fixed);
  assert.equal(f.calls.length, 1);
});
