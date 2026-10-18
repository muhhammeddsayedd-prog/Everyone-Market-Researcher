import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  foundationAllowedRequest,
  foundationManagementTransport,
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
      '/api/v1/workflows?projectId=pHvQjDmjxVZ3KQLT&excludePinnedData=true&limit=100',
      null,
    ),
    true,
  );
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
function responseFixture(headers, bytes, { socketCloseDelay = 0, socketNeverCloses = false } = {}) {
  return foundationManagementTransport({
    resolveInstance: async () => [{ address: '1.1.1.1', family: 4 }],
    timeoutMs: 100,
    closeTimeoutMs: 5,
    request: (_o, callback) => {
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
          res.complete = true;
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
