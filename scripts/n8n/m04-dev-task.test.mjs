import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTask, validOperation } from './m04-dev-task.mjs';
test('only concrete M04 task and phase pairs are accepted', () => {
  assert.equal(validOperation('ProviderMetadata', 'default'), true);
  for (const [task, phase] of [
    ['Admin', 'default'],
    ['Setup', 'arbitrary'],
    ['Stage', 'execute'],
    ['Restore', 'production'],
  ])
    assert.equal(validOperation(task, phase), false);
});
function transport(responses) {
  const calls = [],
    closed = [];
  return {
    calls,
    closed,
    dependencies: {
      charge() {},
      result() {},
      jsonTransport(options) {
        return {
          async send(method, path, body) {
            assert.equal(options.allowed(method, path, body), true);
            assert.equal(method, 'GET');
            calls.push({ host: options.host, api: options.api, path });
            const response = responses.shift();
            if (response instanceof Error) throw response;
            return response;
          },
          close() {
            closed.push(options.api);
          },
        };
      },
    },
  };
}
const good = [
  { status: 200, body: { data: { id: 'OwnerId123', email: 'not-returned@example.invalid' } } },
  {
    status: 200,
    body: {
      data: {
        id: 'ActorId123',
        username: 'apify',
        name: 'instagram-scraper',
        taggedBuilds: { latest: { buildId: 'BuildId123' } },
        pricingInfos: [{ pricingModel: 'PAY_PER_EVENT' }],
      },
    },
  },
  { status: 200, body: { data: { status: 'SUCCEEDED', buildNumber: '1.2.3' } } },
  {
    status: 200,
    body: {
      components: {
        schemas: {
          inputSchema: { type: 'object', properties: { resultsType: { enum: ['posts', 'reels'] } } },
        },
      },
    },
  },
];
test('metadata uses one authenticated identity read and three public pinned actor/build reads', async () => {
  const t = transport(structuredClone(good));
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.status, 'completed');
  assert.equal(t.calls.length, 4);
  assert.equal(t.calls[0].api, 'apify');
  assert.equal(t.calls[1].api, 'no_machine');
  assert.equal(r.private.provider.buildId, 'BuildId123');
  assert.equal(JSON.stringify(r.public).includes('not-returned'), false);
  assert.equal(JSON.stringify(r).includes('synthetic-private-key'), false);
  assert.equal(t.closed.length, 2);
});
test('unsupported owner read stops before actor metadata and keeps credential failures private', async () => {
  const t = transport([{ status: 403, body: { error: { message: 'synthetic-private-key' } } }]);
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.code, 'M04_APIFY_OWNER_READ_UNAVAILABLE');
  assert.equal(t.calls.length, 1);
  assert.equal(JSON.stringify(r).includes('synthetic-private-key'), false);
});
test('transport errors produce a fixed diagnostic and no blind request replay', async () => {
  const t = transport([Error('synthetic-private-key')]);
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.code, 'M04_TRANSPORT_OR_CONTRACT_FAILURE');
  assert.equal(t.calls.length, 1);
  assert.equal(t.closed.length, 2);
});
test('recorded provider pins are retained rather than rediscovered or overwritten', async () => {
  const t = transport([]),
    state = { provider: { owner_id: 'OwnerId123' } };
  const r = await runTask({ task: 'ProviderMetadata', state }, t.dependencies);
  assert.equal(r.public.code, 'M04_PROVIDER_ALREADY_RECORDED');
  assert.equal(t.calls.length, 0);
  assert.deepEqual(r.private, state);
});
test('unclosed transport ownership is blocking even after successful metadata reads', async () => {
  const t = transport(structuredClone(good)),
    original = t.dependencies.jsonTransport;
  t.dependencies.jsonTransport = (options) => ({ ...original(options), close: () => false });
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.status, 'blocked');
  assert.equal(r.public.code, 'M04_TRANSPORT_CLOSE_FAILED');
});
test('untrusted actor IDs and build numbers cannot become provider request paths or pins', async () => {
  for (const [field, value] of [
    ['id', 'Actor/other'],
    ['buildNumber', 'latest'],
  ]) {
    const responses = structuredClone(good);
    if (field === 'id') responses[1].body.data.id = value;
    else responses[2].body.data.buildNumber = value;
    const t = transport(responses),
      r = await runTask(
        { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
        t.dependencies,
      );
    assert.equal(r.public.status, 'blocked');
    assert.equal(r.public.code, 'M04_BUILD_METADATA_UNAVAILABLE');
    assert.equal(t.calls.length, field === 'id' ? 2 : 3);
  }
});
test('access checks use only safe reads or denied operations and keep the five outcomes distinct', async () => {
  const calls = [],
    deps = {
      charge() {},
      result() {},
      jsonTransport(options) {
        return {
          async send(method, path, body) {
            assert.equal(options.allowed(method, path, body), true);
            assert.equal(method, 'POST');
            assert.equal(path, '/api/internal/n8n/collectors');
            calls.push(body.operation);
            if (options.api === 'no_machine')
              return { status: 401, body: { error: { code: 'unauthorized' } } };
            if (options.extraHeaders.cookie) return { status: 403, body: { error: { code: 'forbidden' } } };
            if (body.operation === 'sql')
              return { status: 400, body: { error: { code: 'invalid_request' } } };
            if (body.operation === 'resolve')
              return { status: 403, body: { error: { code: 'account_not_permitted' } } };
            return { status: 200, body: { result: { scope: 'unknown' } } };
          },
          close() {
            return true;
          },
          state() {
            return { pendingRequests: 0, unclosedResponses: 0 };
          },
        };
      },
    };
  const r = await runTask(
    {
      task: 'Probe',
      state: {
        deployment: { audience: 'https://everyone-market-researcher-example.vercel.app' },
        native: { published: true },
        protectionBypass: 'synthetic-bypass',
      },
      secrets: { machine: 'synthetic-machine-token' },
    },
    deps,
  );
  assert.equal(r.public.status, 'completed');
  assert.equal(r.private.accessVerified, true);
  assert.deepEqual(
    r.public.probes.map((p) => p.status),
    [200, 401, 403, 400, 403],
  );
  assert.deepEqual(calls, ['callback.classify', 'callback.classify', 'callback.classify', 'sql', 'resolve']);
  assert.equal(JSON.stringify(r.public).includes('synthetic-'), false);
});
