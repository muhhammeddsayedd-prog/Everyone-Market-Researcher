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
import * as liveTransport from './foundation-live-runtime-transport.mjs';
import { nativeWriterClient } from './gw01-writer.mjs';

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

test('readonly baseline preflight uses only25 source-owned GETs and admits each against the existing budget', async () => {
  let attempts = 0;
  const managementBudget = Object.freeze({ syntheticBudgetOwner: true }),
    deadlineAt = Date.now() + 60000;
  const dto = (b) => ({
    ...structuredClone(b.body),
    settings: { ...structuredClone(b.body.settings), ...(b.nativeReadonlySettings ?? {}) },
    id: b.id,
    versionId: b.versionId,
    active: false,
    activeVersionId: null,
    activeVersion: null,
    isArchived: false,
    pinData: {},
    shared: [{ projectId: p.projectId, role: 'workflow:owner' }],
    tags: structuredClone(b.tags),
  });
  const f = fixture({
    value: (o) =>
      dto(p.baseline.find((b) => o.path === '/api/v1/workflows/' + b.id + '?excludePinnedData=true')),
    create: (d) =>
      liveTransport.createFoundationLiveBaselinePreflight(
        {
          bindings: p.bindings,
          records: Object.keys(p.bindings.workflowRefs).map((key) =>
            JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
          ),
          apiKey: 'SYNTHETIC_PRIVATE_PREFLIGHT',
          deadlineAt,
          managementBudget,
          admitManagementAttempt() {
            attempts++;
          },
        },
        d,
      ),
  });
  const receipt = await f.t.read();
  assert.deepEqual(receipt, { verifiedWorkflows: 25 });
  const scope = { baseline: p.baseline, deadlineAt, managementBudget };
  assert.equal(liveTransport.assertFoundationLiveBaselineReceipt(receipt, scope), receipt);
  for (const [proof, context] of [
    [{ ...receipt }, scope],
    [receipt, { ...scope, deadlineAt: deadlineAt + 1 }],
    [receipt, { ...scope, managementBudget: {} }],
    [receipt, { ...scope, baseline: p.baseline.slice(1) }],
  ])
    assert.throws(() => liveTransport.assertFoundationLiveBaselineReceipt(proof, context));
  liveTransport.claimFoundationLiveBaselineReceipt(receipt, scope);
  assert.throws(() => liveTransport.claimFoundationLiveBaselineReceipt(receipt, scope));
  assert.equal(attempts, 25);
  assert.equal(f.options.length, 25);
  assert.equal(
    f.options.every((o) => o.method === 'GET' && o.path.endsWith('?excludePinnedData=true')),
    true,
  );
  assert.equal(f.writes.length, 0);
  assert.equal(f.t.diagnostics(), null);
  await assert.rejects(f.t.read());
  f.t.close();
});

test('baseline preflight drift stops at the failing owned GET with fixed diagnosis and no writes', async () => {
  let attempts = 0;
  const f = fixture({
    value: { name: 'SYNTHETIC_PRIVATE_BODY' },
    create: (d) =>
      liveTransport.createFoundationLiveBaselinePreflight(
        {
          bindings: p.bindings,
          records: Object.keys(p.bindings.workflowRefs).map((key) =>
            JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
          ),
          apiKey: 'SYNTHETIC_PRIVATE_PREFLIGHT',
          deadlineAt: Date.now() + 60000,
          admitManagementAttempt() {
            attempts++;
          },
        },
        d,
      ),
  });
  await assert.rejects(f.t.read(), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
  assert.equal(attempts, 1);
  assert.equal(f.options.length, 1);
  assert.equal(f.writes.length, 0);
  assert.equal(f.t.diagnostics().workflowKey, p.baseline[0].key);
  assert.equal(JSON.stringify(f.t.diagnostics()).includes('SYNTHETIC_PRIVATE_BODY'), false);
  f.t.close();
});

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

function writerCloseFixture({
  fault,
  prior = [],
  append,
  endHangs = false,
  destroyCloses = true,
  windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
} = {}) {
  const rows = [],
    queries = [];
  let nativeClosed = false,
    closed = false,
    ends = 0,
    clients = 0;
  const binding = {
    audience: 'https://everyone-market-researcher-synthetic-close.vercel.app',
    sourceCommitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticClose',
  };
  const identity = () => ({
    currentUser: 'n8n_writer',
    sessionUser: 'n8n_writer',
    database: 'postgres',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
  });
  const receipt = () => ({
    state: closed ? 'closed' : 'admitted',
    code: closed ? 'window_closed' : null,
    result: null,
    replayed: false,
    operation: 'identity.read',
    window: {
      id: windowId,
      startsAt: null,
      expiresAt: null,
      closed,
      totalAdmitted: closed ? 1 : 0,
      boundAudience: binding.audience,
      boundCommitSha: binding.sourceCommitSha,
      boundDeploymentId: binding.deploymentId,
    },
  });
  const client = new EventEmitter();
  client.connect = async () => {};
  client.query = async (text, values) => {
    queries.push({ text, values });
    const mode = values?.[2];
    if (mode === 'close') {
      assert.equal(
        rows.some((r) => r.event === 'foundation_writer_close_intent'),
        true,
      );
      closed = true;
    }
    const value = values ? { receipt: receipt() } : identity();
    const changed = fault?.({ mode, value, queries });
    if (changed?.then) return await changed;
    return { rows: [changed ?? value] };
  };
  const finish = () => {
    nativeClosed = true;
    client.emit('end');
  };
  client.end = () => {
    ends++;
    if (endHangs) return new Promise(() => {});
    finish();
    return Promise.resolve();
  };
  client.connection = {
    stream: {
      destroy() {
        if (destroyCloses) finish();
      },
    },
  };
  const t = liveTransport.createFoundationLiveWriterCloser(
    {
      password: 'SYNTHETIC_PRIVATE_WRITER_CLOSE',
      ...binding,
      windowId,
      deadlineAt: Date.now() + 60000,
      previousEvents: prior,
      append:
        append ??
        ((r) => {
          rows.push(r);
        }),
    },
    {
      createClient(password) {
        assert.equal(password, 'SYNTHETIC_PRIVATE_WRITER_CLOSE');
        clients++;
        return client;
      },
      timeoutMs: 15,
      closeTimeoutMs: 5,
    },
  );
  return {
    t,
    rows,
    queries,
    binding,
    clients: () => clients,
    ends: () => ends,
    nativeClosed: () => nativeClosed,
  };
}

test('restricted Writer Close verifies identity/binding, durably admits once and awaits native end', async () => {
  const f = writerCloseFixture();
  const result = await f.t.closeWindow();
  assert.deepEqual(result, {
    identityVerified: true,
    bindingVerified: true,
    closeAttempted: true,
    closeAcknowledged: true,
    closeVerified: true,
    connectionClosed: true,
  });
  assert.equal(f.clients(), 1);
  assert.equal(f.ends(), 1);
  assert.equal(f.nativeClosed(), true);
  assert.deepEqual(
    f.queries.map((q) => q.values?.[2] ?? 'identity'),
    ['identity', 'inspect', 'close', 'identity', 'inspect'],
  );
  assert.equal(f.queries.filter((q) => q.values?.[2] === 'close').length, 1);
  assert.equal(f.rows[0].event, 'foundation_writer_close_intent');
  assert.equal(f.rows[1].event, 'foundation_writer_close_verified');
  assert.equal(JSON.stringify({ result, rows: f.rows }).includes('SYNTHETIC_PRIVATE_WRITER_CLOSE'), false);
  assert.deepEqual(await f.t.closeWindow(), result);
  assert.deepEqual(f.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
});

test('Writer Close binds the exact third owned window without reusing either closed-window intent', async () => {
  const f = writerCloseFixture({ windowId: 'eda4fae1-1e19-47db-81b8-beac1a4ed883' });
  const result = await f.t.closeWindow();
  assert.equal(result.closeVerified, true);
  assert.equal(f.rows[0].windowId, 'eda4fae1-1e19-47db-81b8-beac1a4ed883');
  assert.equal(f.queries.filter((q) => q.values?.[2] === 'close').length, 1);
  assert.throws(() => writerCloseFixture({ windowId: '11111111-1111-4111-8111-111111111111' }));
});

test('Writer Close binds the fourth owned window and keeps all three predecessor intents closed', async () => {
  const windowId = '3c46c791-e140-4eb9-890a-eecfa251f65e';
  const f = writerCloseFixture({ windowId });
  assert.equal((await f.t.closeWindow()).closeVerified, true);
  assert.equal(f.rows[0].windowId, windowId);
  assert.equal(f.queries.filter((q) => q.values?.[2] === 'close').length, 1);
  assert.equal(
    f.queries.filter((q) => q.values).every((q) => q.values[0] === windowId),
    true,
  );
  assert.equal(f.ends(), 1);
});

test('Writer Close refuses wrong actual login or binding before durable mutation intent', async () => {
  for (const wrong of ['identity', 'binding']) {
    const f = writerCloseFixture({
      fault({ mode, value }) {
        if (wrong === 'identity' && mode === undefined) value.sessionUser = 'postgres';
        if (wrong === 'binding' && mode === 'inspect') value.receipt.window.boundDeploymentId = 'dpl_Foreign';
      },
    });
    const result = await f.t.closeWindow();
    assert.equal(result.closeVerified, false);
    assert.equal(result.connectionClosed, true);
    assert.equal(f.rows.length, 0);
    assert.equal(
      f.queries.some((q) => q.values?.[2] === 'close'),
      false,
    );
  }
});

test('lost Writer Close acknowledgement reconciles by inspect without replaying the mutation', async () => {
  const f = writerCloseFixture({
    fault({ mode }) {
      if (mode === 'close') throw Error('SYNTHETIC_PRIVATE_PASSWORD_URL');
    },
  });
  const result = await f.t.closeWindow();
  assert.equal(result.closeAcknowledged, false);
  assert.equal(result.closeVerified, true);
  assert.equal(f.queries.filter((q) => q.values?.[2] === 'close').length, 1);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE_PASSWORD_URL'), false);
});

test('existing durable Close intent permits read-only reconciliation only; async append never authorizes RPC', async () => {
  const first = writerCloseFixture();
  await first.t.closeWindow();
  const f = writerCloseFixture({ prior: [first.rows[0]] });
  const result = await f.t.closeWindow();
  assert.equal(result.closeVerified, false);
  assert.equal(result.closeAttempted, false);
  assert.equal(
    f.queries.some((q) => q.values?.[2] === 'close'),
    false,
  );
  const asyncIntent = writerCloseFixture({ append: async () => {} });
  assert.equal((await asyncIntent.t.closeWindow()).closeVerified, false);
  assert.equal(
    asyncIntent.queries.some((q) => q.values?.[2] === 'close'),
    false,
  );
});

test('Writer Close never accepts expired-only state as permanent closure and requires post-RPC proof', async () => {
  const f = writerCloseFixture({
    fault({ mode, value, queries }) {
      if (mode === 'inspect' && !queries.some((q) => q.values?.[2] === 'close')) {
        value.receipt.state = 'closed';
        value.receipt.code = 'window_expired';
        value.receipt.window.closed = true;
      }
    },
  });
  assert.equal((await f.t.closeWindow()).closeVerified, true);
  assert.equal(f.queries.filter((q) => q.values?.[2] === 'close').length, 1);
  const badPost = writerCloseFixture({
    fault({ mode, value, queries }) {
      if (mode === 'inspect' && queries.some((q) => q.values?.[2] === 'close'))
        value.receipt.window.closed = false;
    },
  });
  assert.equal((await badPost.t.closeWindow()).closeVerified, false);
});

test('Writer Close bounds physical end and retains transport authority when native closure is unknown', async () => {
  const forced = writerCloseFixture({ endHangs: true });
  assert.equal((await forced.t.closeWindow()).connectionClosed, true);
  assert.deepEqual(forced.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
  const unknown = writerCloseFixture({ endHangs: true, destroyCloses: false });
  const result = await unknown.t.closeWindow();
  assert.equal(result.connectionClosed, false);
  assert.equal(result.closeVerified, false);
  assert.equal(
    unknown.rows.some((r) => r.event === 'foundation_writer_close_verified'),
    false,
  );
  unknown.t.close();
  assert.deepEqual(unknown.t.state(), { pendingRequests: 0, unclosedResponses: 1 });
  assert.equal(unknown.ends(), 1);
});

test('Writer Close query timeout and credential-bearing errors are bounded fixed refusals before admission', async () => {
  for (const fault of [
    () => {
      throw Error('postgres://private-user:synthetic-password-writer@example.invalid');
    },
    () => new Promise(() => {}),
  ]) {
    const f = writerCloseFixture({ fault });
    const result = await f.t.closeWindow();
    assert.equal(result.closeAttempted, false);
    assert.equal(result.connectionClosed, true);
    assert.equal(f.rows.length, 0);
    assert.equal(JSON.stringify(result).includes('synthetic-password-writer'), false);
    assert.deepEqual(f.t.state(), { pendingRequests: 0, unclosedResponses: 0 });
  }
});

test('Writer Close refuses duplicate or foreign durable intents before constructing a Client', async () => {
  const f = writerCloseFixture();
  await f.t.closeWindow();
  for (const prior of [[f.rows[0], f.rows[0]], [{ ...f.rows[0], deploymentId: 'dpl_Foreign' }]])
    assert.throws(() => writerCloseFixture({ prior }), /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/);
});

test('Writer Close preserves both earlier reviewed identities without reusing historical Close intent', async () => {
  const old = writerCloseFixture();
  await old.t.closeWindow();
  const fresh = writerCloseFixture({
    windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
    prior: [old.rows[0]],
  });
  assert.equal((await fresh.t.closeWindow()).closeVerified, true);
  assert.equal(
    fresh.queries.every((q) => !q.values || q.values[0] === '38b3708d-61b0-41d2-8170-5ed91c66b4dc'),
    true,
  );
  assert.throws(
    () => writerCloseFixture({ windowId: '11111111-1111-4111-8111-111111111111' }),
    /FOUNDATION_LIVE_MANAGEMENT_BLOCKED/,
  );
});

test('reused native Writer factory pins only the existing strict dev session connection without connecting', async () => {
  const c = nativeWriterClient('SYNTHETIC_NATIVE_WRITER_NOT_USED');
  assert.equal(c.host, 'aws-1-eu-central-1.pooler.supabase.com');
  assert.equal(c.port, 5432);
  assert.equal(c.database, 'postgres');
  assert.equal(c.user, 'n8n_writer.zmotjsbzhzjvpelxvxlf');
  assert.equal(c.ssl.rejectUnauthorized, true);
  assert.equal(c.ssl.minVersion, 'TLSv1.2');
  assert.equal(typeof c.ssl.checkServerIdentity, 'function');
  assert.equal(c.ssl.servername, c.host);
  assert.equal(c.connectionParameters.statement_timeout, 8000);
  assert.equal(c.connectionParameters.query_timeout, 10000);
  assert.equal(c._connected, false);
  await c.end();
});
