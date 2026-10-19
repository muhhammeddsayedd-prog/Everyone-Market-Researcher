import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  foundationAllowedRequest,
  foundationManagementTransport,
  foundationTransportDiagnostic,
  validateFoundationAddresses,
} from './foundation-management-transport.mjs';
import { buildShell } from './foundation-provision.mjs';
test('only exact shell create, project metadata, scoped list and owned ID GET are admitted', () => {
  assert.equal(foundationAllowedRequest('POST', '/api/v1/workflows', buildShell('WF-00')), true);
  for (const path of [
    '/api/v1/workflows/X/activate',
    '/api/v1/workflows/X/publish',
    '/api/v1/executions',
    '/api/v1/credentials',
    '/api/v1/variables',
  ])
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'GET'])
      assert.equal(
        foundationAllowedRequest(m, path, null, () => true),
        false,
      );
  assert.equal(
    foundationAllowedRequest('GET', '/api/v1/workflows/Owned', null, (x) => x === 'Owned'),
    true,
  );
  assert.equal(
    foundationAllowedRequest('GET', '/api/v1/workflows/Other', null, (x) => x === 'Owned'),
    false,
  );
  assert.equal(
    foundationAllowedRequest('POST', '/api/v1/workflows', { ...buildShell('WF-00'), active: true }),
    false,
  );
  assert.equal(
    foundationAllowedRequest(
      'GET',
      '/api/v1/workflows?projectId=pHvQjDmjxVZ3KQLT&excludePinnedData=true&name=%5Bdev%5D&limit=100',
      null,
    ),
    true,
  );
  for (const path of [
    '/api/v1/workflows?projectId=pHvQjDmjxVZ3KQLT&excludePinnedData=true&limit=100',
    '/api/v1/workflows?projectId=pHvQjDmjxVZ3KQLT&excludePinnedData=true&name=%25&limit=100',
    '/api/v1/workflows?projectId=pHvQjDmjxVZ3KQLT&excludePinnedData=true&name=%5Bdev%5D&name=%5Bdev%5D&limit=100',
  ])
    assert.equal(foundationAllowedRequest('GET', path, null), false);
  assert.equal(
    foundationAllowedRequest(
      'GET',
      '/api/v1/workflows?projectId=other&excludePinnedData=true&limit=100',
      null,
    ),
    false,
  );
});
test('public DNS requires every answer and rejects loopback/embedded/private/documentation addresses', () => {
  const p = { address: '1.1.1.1', family: 4 };
  assert.deepEqual(validateFoundationAddresses([p]), [p]);
  for (const address of [
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '192.168.0.1',
    '::1',
    '::ffff:c0a8:1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
  ])
    assert.throws(() => validateFoundationAddresses([p, { address, family: address.includes(':') ? 6 : 4 }]));
});
test('native writes require short mapped labels and explicit draft-only graph PUT query', () => {
  const body = { name: 'Synthetic inactive source', nodes: [], connections: {}, settings: {} },
    binding = {
      workflowBodies: new Map([['Owned', body]]),
      workflowTagBodies: new Map([['Owned', [{ id: 'Tag0' }]]]),
    };
  const owns = (x) => x === 'Owned';
  assert.equal(
    foundationAllowedRequest('PUT', '/api/v1/workflows/Owned?publishIfActive=false', body, owns, binding),
    true,
  );
  for (const suffix of [
    '',
    '?publishIfActive=true',
    '?publishIfActive=false&publishIfActive=false',
    '?publishIfActive=false&other=1',
  ])
    assert.equal(
      foundationAllowedRequest('PUT', '/api/v1/workflows/Owned' + suffix, body, owns, binding),
      false,
    );
  assert.equal(
    foundationAllowedRequest('PUT', '/api/v1/workflows/Owned/tags', [{ id: 'Tag0' }], owns, binding),
    true,
  );
  assert.equal(
    foundationAllowedRequest('POST', '/api/v1/tags', { name: 'platform:ig_stories' }, owns, binding),
    true,
  );
  assert.equal(
    foundationAllowedRequest('POST', '/api/v1/tags', { name: 'platform:instagram_stories' }, owns, binding),
    false,
  );
  assert.equal(
    foundationAllowedRequest('GET', '/api/v1/credentials/EmrFoundationMachine19', null, owns, binding),
    false,
  );
  assert.equal(
    foundationAllowedRequest('GET', '/api/v1/credentials/EmrM03Machine19', null, owns, binding),
    true,
  );
});
test('ordinary synthetic API key reaches DNS gate; controls are rejected before DNS', async () => {
  let calls = 0;
  const send = foundationManagementTransport({
    resolveInstance: async () => {
      calls++;
      return [];
    },
  });
  await assert.rejects(
    send('GET', '/api/v1/projects?limit=100', null, 'SYNTHETIC_TEST_KEY'),
    /FOUNDATION_TRANSPORT_DNS/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    send('GET', '/api/v1/projects?limit=100', null, 'bad\nkey'),
    /FOUNDATION_REQUEST_REJECTED/,
  );
  assert.equal(calls, 1);
});
test('absolute credential lease deadline blocks before DNS or authentication', async () => {
  let calls = 0;
  const send = foundationManagementTransport({
    deadlineMs: Date.now() - 1,
    resolveInstance: async () => {
      calls++;
      return [{ address: '1.1.1.1', family: 4 }];
    },
  });
  await assert.rejects(
    send('GET', '/api/v1/projects?limit=100', null, 'SYNTHETIC_KEY'),
    /^Error: FOUNDATION_TRANSPORT_DEADLINE$/,
  );
  assert.equal(calls, 0);
});
function responseFixture(
  headers,
  bytes,
  { socketCloseDelay = 0, socketNeverCloses = false, complete = true, onRequest = () => {} } = {},
) {
  return foundationManagementTransport({
    resolveInstance: async () => [{ address: '1.1.1.1', family: 4 }],
    timeoutMs: 100,
    closeTimeoutMs: 5,
    request: (_o, callback) => {
      onRequest(_o);
      const req = new EventEmitter();
      const socket = new EventEmitter();
      const closeSocket = () => {
        if (!socketNeverCloses) setTimeout(() => socket.emit('close'), socketCloseDelay);
      };
      socket.destroy = closeSocket;
      let res;
      req.destroy = () =>
        queueMicrotask(() => {
          res?.emit('close');
          req.emit('close');
          closeSocket();
        });
      req.write = () => {};
      req.end = () =>
        queueMicrotask(() => {
          req.emit('socket', socket);
          socket.emit('secureConnect');
          res = new EventEmitter();
          res.statusCode = 200;
          res.headers = headers;
          res.complete = complete;
          res.destroy = () => queueMicrotask(() => res.emit('close'));
          callback(res);
          res.emit('data', bytes);
          res.emit('end');
          res.emit('close');
          req.emit('close');
          closeSocket();
        });
      return req;
    },
  });
}
test('management response rejects compressed framing and length plus transfer encoding', async () => {
  for (const headers of [
    { 'content-encoding': 'gzip' },
    { 'content-length': '2', 'transfer-encoding': 'chunked' },
  ])
    await assert.rejects(
      responseFixture(headers, Buffer.from('{}'))('GET', '/api/v1/projects?limit=100', null, 'SYNTHETIC_KEY'),
    );
});
test('only identity and chunked tokens are accepted case-insensitively, and identity is explicitly requested', async () => {
  let options;
  const r = await responseFixture(
    { 'content-encoding': 'Identity', 'transfer-encoding': 'Chunked' },
    Buffer.from('{}'),
    { onRequest: (x) => (options = x) },
  )('GET', '/api/v1/projects?limit=100', null, 'SYNTHETIC_KEY');
  assert.equal(r.status, 200);
  assert.equal(options.headers['accept-encoding'], 'identity');
});
test('fixed failure projection preserves HTTP status and first fault without raw headers or body', async () => {
  for (const [headers, bytes, options, reason] of [
    [{ 'content-encoding': 'gzip' }, Buffer.from('PRIVATE_BODY'), {}, 'content_encoding_rejected'],
    [
      { 'transfer-encoding': 'Chunked', 'content-length': '2' },
      Buffer.from('{}'),
      {},
      'transfer_framing_rejected',
    ],
    [{ 'content-length': 'invalid-private-header' }, Buffer.from('{}'), {}, 'content_length_invalid'],
    [{ 'content-length': '524289' }, Buffer.from('{}'), {}, 'body_declared_limit'],
    [{}, Buffer.alloc(524289), {}, 'body_stream_limit'],
    [{}, Buffer.from('{}'), { complete: false }, 'body_incomplete'],
    [{ 'content-length': '3' }, Buffer.from('{}'), {}, 'body_length_mismatch'],
    [{}, Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]), {}, 'utf8_invalid'],
    [{}, Buffer.from('PRIVATE_INVALID_JSON'), {}, 'json_invalid'],
  ]) {
    let error;
    try {
      await responseFixture(headers, bytes, options)(
        'GET',
        '/api/v1/projects?limit=100',
        null,
        'SYNTHETIC_KEY',
      );
    } catch (e) {
      error = e;
    }
    const d = foundationTransportDiagnostic(error);
    assert.equal(d.httpStatus, 200);
    assert.equal(d.transportReason, reason);
    assert.equal(JSON.stringify(d).includes('PRIVATE'), false);
    assert.equal(Object.keys(d).sort().join(','), 'httpStatus,transportCode,transportReason');
  }
  const native = Error('PRIVATE_NATIVE_ERROR');
  assert.deepEqual(foundationTransportDiagnostic(native), {
    httpStatus: null,
    transportCode: 'unclassified',
    transportReason: null,
  });
});
test('successful result waits for the actual assigned TLS socket close', async () => {
  let settled = false;
  const pending = responseFixture({}, Buffer.from('{}'), { socketCloseDelay: 30 })(
    'GET',
    '/api/v1/projects?limit=100',
    null,
    'SYNTHETIC_KEY',
  ).then((x) => {
    settled = true;
    return x;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert.equal((await pending).status, 200);
});
test('request and response close do not prove socket closure', async () => {
  await assert.rejects(
    responseFixture({}, Buffer.from('{}'), { socketNeverCloses: true })(
      'GET',
      '/api/v1/projects?limit=100',
      null,
      'SYNTHETIC_KEY',
    ),
    /^Error: FOUNDATION_TRANSPORT_CLOSE$/,
  );
});
test('management response rejects malformed UTF8 rather than replacing bytes inside otherwise valid JSON', async () => {
  const bytes = Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]);
  await assert.rejects(
    responseFixture({}, bytes)('GET', '/api/v1/projects?limit=100', null, 'SYNTHETIC_KEY'),
  );
});
