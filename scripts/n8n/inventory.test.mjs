import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventEmitter } from 'node:events';
import {
  inventoryWorkflowNames,
  probePublicInventoryTransport,
  resolveInstance,
  runInventory,
} from './inventory.mjs';

const key = 'synthetic-n8n-key-for-local-tests-only';
const projectId = 'pHvQjDmjxVZ3KQLT';
const host = 'muhhammedsayed.app.n8n.cloud';
const bytes = (value) => Buffer.from(JSON.stringify(value));
const good = {
  discover: {
    data: {
      scopes: ['workflow:list'],
      resources: {
        workflow: {
          operations: ['list'],
          endpoints: [{ method: 'GET', path: '/api/v1/workflows', operationId: 'getWorkflows' }],
        },
      },
      filters: {},
      specUrl: '/api/v1/openapi.yml',
    },
  },
  projects: {
    data: [{ id: projectId, name: 'synthetic private owner name', type: 'personal' }],
    nextCursor: null,
  },
  workflows: {
    data: [
      {
        id: 'syntheticWorkflow1',
        name: 'WF-00 · Orchestrator [dev]',
        active: false,
        isArchived: false,
        shared: [{ projectId, role: 'workflow:owner' }],
        nodes: [{ parameters: { secret: 'synthetic-nested-secret' } }],
        pinData: { secret: 'synthetic-pin-secret' },
      },
      {
        id: 'unrelatedWorkflow',
        name: 'synthetic unrelated client workflow',
        active: true,
        isArchived: false,
        shared: [{ projectId, role: 'workflow:owner' }],
      },
    ],
    nextCursor: null,
  },
  credentials: {
    data: [
      {
        id: 'syntheticCredential1',
        name: 'Apify account',
        type: 'apifyApi',
        shared: [{ id: projectId, name: 'synthetic Personal owner name', role: 'credential:owner' }],
        data: { token: 'synthetic-nested-secret' },
      },
      {
        id: 'unrelatedCredential',
        name: 'synthetic unrelated client credential',
        type: 'httpHeaderAuth',
        shared: [{ id: projectId, name: 'synthetic Personal owner name', role: 'credential:owner' }],
      },
    ],
    nextCursor: null,
  },
};
function fixture(overrides = {}) {
  const calls = [];
  const deps = {
    credentialCandidates: [
      { key: 'apify', id: 'syntheticCredential1', name: 'Apify account', type: 'apifyApi' },
    ],
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async (input) => {
      calls.push(input);
      const resource = input.url.pathname.split('/').at(-1);
      const response = Object.hasOwn(overrides, resource)
        ? overrides[resource]
        : { status: 200, body: bytes(good[resource]) };
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response(input) : response;
    },
  };
  return { calls, deps };
}
describe('M03 OS DNS adapter, synthetic callbacks only', () => {
  it('uses the fixed host/all:true and preserves public IPv4/IPv6 results and pinned first address', async () => {
    const addresses = [
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ];
    const f = fixture();
    f.deps.lookup = (signal) =>
      resolveInstance(signal, (value, options, callback) => {
        assert.equal(value, host);
        assert.deepEqual(options, { all: true });
        callback(null, addresses);
      });
    assert.equal((await runInventory(key, f.deps)).status, 'complete');
    assert.equal(f.calls.length, 4);
    for (const call of f.calls) assert.deepEqual(call.address, addresses[0]);
  });
  for (const [name, answer] of [
    ['empty', []],
    ['private', [{ address: '127.0.0.1', family: 4 }]],
    [
      'mixed',
      [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    ],
    ['wrong family', [{ address: '8.8.8.8', family: 6 }]],
  ])
    it(`rejects ${name} OS results before any HTTP request`, async () => {
      const f = fixture();
      f.deps.lookup = (signal) =>
        resolveInstance(signal, (_host, _options, callback) => callback(null, answer));
      assert.equal((await runInventory(key, f.deps)).status, 'unsafe_dns');
      assert.equal(f.calls.length, 0);
    });
  it('treats ENOTFOUND as no usable addresses without exposing its message', async () => {
    const f = fixture();
    f.deps.lookup = (signal) =>
      resolveInstance(signal, (_host, _options, callback) =>
        callback(Object.assign(new Error('synthetic-private-DNS'), { code: 'ENOTFOUND' })),
      );
    const result = await runInventory(key, f.deps);
    assert.equal(result.status, 'unsafe_dns');
    assert.equal(f.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
  });
  it('does not invoke OS lookup after an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(
      resolveInstance(controller.signal, () => {
        calls++;
      }),
      { code: 'timeout' },
    );
    assert.equal(calls, 0);
  });
  it('ignores a late OS callback after deadline and never starts HTTP', async () => {
    const f = fixture();
    f.deps.timeoutMs = 20;
    let complete;
    f.deps.lookup = (signal) =>
      resolveInstance(signal, (_host, _options, callback) => {
        complete = callback;
      });
    const result = await runInventory(key, f.deps);
    assert.equal(result.status, 'timeout');
    complete(null, [{ address: '8.8.8.8', family: 4 }]);
    await new Promise((done) => setImmediate(done));
    assert.equal(f.calls.length, 0);
  });
});

function diagnosticRequestFixture({ close = true, delay = 0 } = {}) {
  const calls = [];
  const request = (url, options, responseCallback) => {
    calls.push({ url, options });
    const req = new EventEmitter();
    const socket = new EventEmitter();
    socket.authorized = true;
    socket.encrypted = true;
    req.destroy = () => {
      if (close) socket.emit('close');
    };
    req.end = () => {
      req.emit('socket', socket);
      setImmediate(() => {
        socket.emit('secureConnect');
        const response = new EventEmitter();
        response.statusCode = 401;
        response.headers = {};
        response.destroy = () => {};
        responseCallback(response);
        response.emit('data', Buffer.from('synthetic-private-response-not-projected'));
        response.emit('end');
        if (close) setTimeout(() => socket.emit('close'), delay);
      });
    };
    return req;
  };
  return { calls, request };
}
describe('M03 unauthenticated fixed discovery transport diagnostic, synthetic HTTPS only', () => {
  it('uses the same strict pinned TLS transport without an API key and waits for socket close', async () => {
    const f = diagnosticRequestFixture({ delay: 10 });
    const result = await probePublicInventoryTransport({
      request: f.request,
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      closeTimeoutMs: 50,
    });
    assert.deepEqual(result, { httpStatus: 401, tlsVerified: true, socketClosed: true });
    assert.equal(f.calls.length, 1);
    const { url, options } = f.calls[0];
    assert.equal(url.href, `https://${host}/api/v1/discover`);
    assert.equal(options.method, 'GET');
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, host);
    assert.equal(options.agent, false);
    assert.equal(options.family, 4);
    assert.deepEqual(Object.keys(options.headers).sort(), ['accept', 'user-agent']);
    let pinned;
    options.lookup(host, {}, (error, address, family) => {
      assert.equal(error, null);
      pinned = { address, family };
    });
    assert.deepEqual(pinned, { address: '8.8.8.8', family: 4 });
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
  });
  it('reports a never-closing socket as unverified closure within the bounded wait', async () => {
    const f = diagnosticRequestFixture({ close: false });
    const result = await probePublicInventoryTransport({
      request: f.request,
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      closeTimeoutMs: 10,
    });
    assert.deepEqual(result, { httpStatus: 401, tlsVerified: true, socketClosed: false });
  });
  it('rejects mixed private DNS results before creating HTTPS', async () => {
    const f = diagnosticRequestFixture();
    const result = await probePublicInventoryTransport({
      request: f.request,
      lookup: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    });
    assert.deepEqual(result, { httpStatus: null, tlsVerified: false, socketClosed: false });
    assert.equal(f.calls.length, 0);
  });
});
describe('M03 fixed-instance GET-only n8n inventory, synthetic responses only', () => {
  it('covers all25 canonical binding names without importing dependencies in the private runtime', async () => {
    const { foundationWorkflowNames } = await import('../../packages/shared/src/n8n-bindings.ts');
    assert.equal(inventoryWorkflowNames.length, 25);
    assert.deepEqual([...inventoryWorkflowNames].sort(), Object.values(foundationWorkflowNames).sort());
    const f = fixture({
      workflows: {
        status: 200,
        body: bytes({
          data: inventoryWorkflowNames.map((name, i) => ({
            id: `workflow${i}`,
            name,
            active: false,
            isArchived: false,
            shared: [{ projectId, role: 'workflow:owner' }],
          })),
          nextCursor: null,
        }),
      },
    });
    assert.equal((await runInventory(key, f.deps)).resources.workflows.known.length, 25);
  });
  it('projects only expected names, safe IDs and fixed capability booleans', async () => {
    const f = fixture();
    const result = await runInventory(key, f.deps);
    assert.equal(result.status, 'complete');
    assert.equal(result.projectVerified, true);
    assert.equal(result.resources.workflows.unknownCount, 1);
    assert.equal(result.resources.credentials.unknownCount, 1);
    assert.deepEqual(result.resources.credentials.known, [
      { name: 'Apify account', id: 'syntheticCredential1', type: 'apifyApi' },
    ]);
    assert.equal(result.capabilities.workflowList, true);
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic-(?:nested|pin)|unrelated client|private owner|nodes|parameters|pinData/,
    );
    assert.equal(f.calls.length, 4);
    for (const call of f.calls) {
      assert.equal(call.url.origin, `https://${host}`);
      assert.equal(call.method, 'GET');
      assert.equal(call.rejectUnauthorized, true);
      assert.equal(call.servername, host);
      assert.equal(call.headers['x-n8n-api-key'], key);
      assert.equal(call.url.href.includes(key), false);
    }
    assert.match(f.calls[2].url.search, /projectId=pHvQjDmjxVZ3KQLT/);
    assert.match(f.calls[2].url.search, /excludePinnedData=true/);
  });
  it('rejects absent/invalid keys without DNS or transport', async () => {
    for (const invalid of [undefined, '', {}, 'a\r\nb', 'x'.repeat(4097)]) {
      const f = fixture();
      const r = await runInventory(invalid, f.deps);
      assert.equal(r.requestCount, 0);
      assert.equal(f.calls.length, 0);
      assert.match(r.status, /missing_key|invalid_key/);
    }
  });
  it('rejects unsafe or mixed public/private DNS before any keyed request', async () => {
    const f = fixture();
    f.deps.lookup = async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ];
    const r = await runInventory(key, f.deps);
    assert.equal(r.status, 'unsafe_dns');
    assert.equal(f.calls.length, 0);
  });
  it('refuses redirects without following the supplied location or echoing errors', async () => {
    const f = fixture({
      discover: {
        status: 302,
        body: bytes({ secret: key }),
        headers: { location: 'https://private.invalid' },
      },
    });
    const r = await runInventory(key, f.deps);
    assert.equal(r.status, 'redirect_refused');
    assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(r), /private.invalid|synthetic-n8n/);
  });
  it('records projects403 independently and continues permitted metadata reads', async () => {
    const f = fixture({ projects: { status: 403, body: bytes({ message: key }) } });
    const r = await runInventory(key, f.deps);
    assert.equal(r.resources.projects.status, 'forbidden');
    assert.equal(r.resources.workflows.status, 'complete');
    assert.equal(r.resources.credentials.status, 'complete');
    assert.equal(r.authenticationVerified, true);
    assert.equal(f.calls.length, 4);
    assert.equal(r.projectVerified, false);
  });
  it('does not call metadata endpoints after a rejected API key', async () => {
    const f = fixture({ discover: { status: 401, body: bytes({ message: key }) } });
    const r = await runInventory(key, f.deps);
    assert.equal(r.status, 'unauthorized');
    assert.equal(r.authenticationVerified, false);
    assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(r), /synthetic-n8n/);
  });
  it('rejects malformed JSON/schema and suppresses unknown input values', async () => {
    for (const body of [
      Buffer.from('{not json'),
      bytes({ data: [{ id: 'bad', name: key, type: 'personal' }], nextCursor: 23 }),
    ]) {
      const f = fixture({ projects: { status: 200, body } });
      const r = await runInventory(key, f.deps);
      assert.equal(r.resources.projects.status, 'response_rejected');
      assert.doesNotMatch(JSON.stringify(r), /synthetic-n8n/);
    }
  });
  it('refuses a known credential in the wrong project or with an unexpected type', async () => {
    for (const change of [
      { type: 'postgres' },
      { type: 'httpHeaderAuth' },
      { name: 'Apify API' },
      { shared: [{ id: 'otherProject', role: 'credential:owner' }] },
    ]) {
      const f = fixture({
        credentials: {
          status: 200,
          body: bytes({ data: [{ ...good.credentials.data[0], ...change }], nextCursor: null }),
        },
      });
      const r = await runInventory(key, f.deps);
      assert.equal(r.resources.credentials.status, 'response_rejected');
      assert.deepEqual(r.resources.credentials.known, []);
    }
  });
  it('rejects duplicate authorized IDs without guessing which credential to use', async () => {
    const f = fixture({
      credentials: {
        status: 200,
        body: bytes({
          data: [good.credentials.data[0], good.credentials.data[0]],
          nextCursor: null,
        }),
      },
    });
    const r = await runInventory(key, f.deps);
    assert.equal(r.resources.credentials.status, 'response_rejected');
    assert.deepEqual(r.resources.credentials.known, []);
  });
  it('selects an explicitly authorized ID while an unrelated same-display-name credential stays private', async () => {
    const f = fixture({
      credentials: {
        status: 200,
        body: bytes({
          data: [good.credentials.data[0], { ...good.credentials.data[0], id: 'unrelatedSameName' }],
          nextCursor: null,
        }),
      },
    });
    const r = await runInventory(key, f.deps);
    assert.equal(r.resources.credentials.status, 'complete');
    assert.equal(r.resources.credentials.unknownCount, 1);
    assert.deepEqual(r.resources.credentials.known, [
      { id: 'syntheticCredential1', name: 'Apify account', type: 'apifyApi' },
    ]);
    assert.ok(!JSON.stringify(r).includes('unrelatedSameName'));
  });
  it('never follows a cursor as a URL and caps pagination at two pages per resource', async () => {
    const f = fixture({
      credentials: {
        status: 200,
        body: bytes({ data: [], nextCursor: 'https://evil.invalid/?key=synthetic' }),
      },
    });
    const r = await runInventory(key, f.deps);
    assert.equal(r.resources.credentials.status, 'response_rejected');
    assert.equal(f.calls.length, 4);
  });
  it('returns incomplete after the second cursor page and never silently calls it complete', async () => {
    let n = 0;
    const f = fixture({
      credentials: () => ({ status: 200, body: bytes({ data: [], nextCursor: `opaqueCursor${++n}` }) }),
    });
    const r = await runInventory(key, f.deps);
    assert.equal(r.resources.credentials.status, 'page_limit');
    assert.equal(f.calls.length, 5);
    assert.equal(r.status, 'partial');
  });
  it('caps response bodies and never includes raw network errors', async () => {
    for (const response of [
      { status: 200, body: Buffer.alloc(4 * 1024 * 1024 + 1) },
      new Error(`synthetic private error ${key}`),
    ]) {
      const f = fixture({ discover: response });
      const r = await runInventory(key, f.deps);
      assert.match(r.status, /body_too_large|network_failed/);
      assert.doesNotMatch(JSON.stringify(r), /synthetic private|synthetic-n8n/);
    }
  });
  it('bounds DNS/transport with a single overall deadline', async () => {
    const f = fixture();
    f.deps.lookup = () => new Promise(() => {});
    f.deps.timeoutMs = 20;
    const r = await runInventory(key, f.deps);
    assert.equal(r.status, 'timeout');
    assert.equal(f.calls.length, 0);
  });
  for (const variant of ['credentialId', 'workflowId', 'cursor', 'projectName'])
    it(`fails closed and clears all projected metadata if the server reflects the private key as ${variant}`, async () => {
      const payload = structuredClone(good);
      if (variant === 'credentialId') payload.credentials.data[0].id = key;
      if (variant === 'workflowId') payload.workflows.data[0].id = key;
      if (variant === 'cursor') payload.credentials.nextCursor = key;
      if (variant === 'projectName') payload.projects.data[0].name = key;
      const f = fixture(
        Object.fromEntries(
          Object.entries(payload).map(([name, value]) => [name, { status: 200, body: bytes(value) }]),
        ),
      );
      const result = await runInventory(key, f.deps);
      assert.equal(result.status, 'confidentiality_rejected');
      assert.doesNotMatch(JSON.stringify(result), /synthetic-n8n-key-for-local-tests-only/);
      for (const section of Object.values(result.resources)) {
        assert.deepEqual(section.known, []);
        assert.equal(section.count, 0);
      }
      assert.equal(
        f.calls.some((call) => call.url.href.includes(key)),
        false,
      );
    });
});
