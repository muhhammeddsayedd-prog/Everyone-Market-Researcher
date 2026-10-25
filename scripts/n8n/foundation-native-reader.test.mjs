import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { foundationRuntimeExecutionParameterCandidates } from './foundation-runtime-checkpoint.mjs';
import { gatewayOperationNodes } from '../../n8n/foundation/build-foundation-gateway.mjs';
import { createFoundationNativeTransport } from './foundation-native-transport.mjs';
import * as nativeReader from './foundation-native-reader.mjs';
import {
  createFoundationNativeReader,
  assertFoundationNativeReader,
  assertFoundationNativeMetadataReceipt,
  assertFoundationNativeReceipt,
  assertFoundationTechnical16CleanupQualification,
  foundationNativeReaderLimits,
} from './foundation-native-reader.mjs';

const instant = Date.parse('2026-10-19T12:00:00.000Z');
const iso = (n) => new Date(instant + n).toISOString();
const secret = 'C01_SYNTHETIC_PRIVATE_VALUE_123456';
export function nativeReaderFixture(options = {}) {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const workflowKey = 'WF-00',
    id = bindings.workflowRefs[workflowKey].id;
  const versionId = 'native-synthetic-version';
  const targetId = bindings.workflowRefs['WF-10'].id;
  const body = {
    name: bindings.workflowRefs[workflowKey].name,
    nodes: [
      {
        id: 'call',
        name: 'Known call',
        type: 'n8n-nodes-base.executeWorkflow',
        typeVersion: 1.4,
        position: [0, 0],
        parameters: { workflowId: { __rl: true, mode: 'id', value: targetId } },
      },
    ],
    connections: {},
    settings: {
      saveManualExecutions: true,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveExecutionProgress: false,
    },
  };
  const binding = {
    workflowId: id,
    versionId,
    activeVersionId: null,
    bodyHash: runtimeGraphHash(body),
    body,
  };
  const metadata = {
    id: '101',
    workflowId: id,
    workflowVersionId: versionId,
    mode: 'manual',
    status: 'success',
    createdAt: iso(-2000),
    startedAt: iso(-1000),
    stoppedAt: iso(-100),
    waitTill: null,
  };
  const workflow = { id, versionId, activeVersionId: null, active: false, ...structuredClone(body) };
  const full = {
    ...metadata,
    workflowData: { id, ...structuredClone(body) },
    data: {
      resultData: {
        runData: {
          'Known call': [
            {
              metadata: { subExecution: { executionId: '102', workflowId: targetId } },
              data: { main: [[{ json: { safe: true } }]] },
            },
          ],
        },
      },
    },
  };
  let clock = instant,
    admissions = 0;
  const calls = [],
    answers = new Map();
  const wire = (value, extra = {}) => ({
    status: 200,
    body: (async function* () {
      yield Buffer.from(JSON.stringify(value));
    })(),
    closed: Promise.resolve(),
    ...extra,
  });
  answers.set('/api/v1/executions/101?includeData=false', () => wire(metadata));
  answers.set('/api/v1/workflows/' + id + '?excludePinnedData=true', () => wire(workflow));
  answers.set('/api/v1/executions/101?includeData=true', () => wire(full));
  const transport = {
    request: async ({ method, path, signal }) => {
      calls.push({ method, path, signal });
      const answer = answers.get(path);
      assert.equal(typeof answer, 'function');
      return answer();
    },
  };
  const reader = createFoundationNativeReader({
    bindings,
    transport,
    admitControlAttempt: () => {
      admissions++;
    },
    now: () => clock,
    deadlineAt: instant + 60000,
    sensitiveValues: [secret],
    bindingValidator: (b) => b,
    ...options,
  });
  return {
    reader,
    bindings,
    workflowKey,
    binding,
    metadata,
    workflow,
    full,
    calls,
    answers,
    wire,
    setClock: (n) => {
      clock = n;
    },
    admissions: () => admissions,
    args: { workflowKey, executionId: '101', binding },
  };
}
const fixed = /^Error: FOUNDATION_NATIVE_[A-Z_]+$/;

function nativeGetRetryFixture({
  failures = ['ECONNRESET', null],
  delays = [],
  neverClose = false,
  denyAdmissionAt = null,
  expireOnRetry = false,
  expireInRetryTurn = false,
  expireDuringResponse = false,
} = {}) {
  const seed = nativeReaderFixture(),
    sent = [],
    charged = [],
    markers = [],
    admissionValues = [],
    sockets = [];
  let admissionCalls = 0;
  const transport = createFoundationNativeTransport(
    {
      apiKey: secret,
      bindings: seed.bindings,
      authorizeExecution: ({ method, executionId }) => method === 'GET' && executionId === '101',
    },
    {
      closeTimeoutMs: 20,
      resolveInstance: async () => [{ address: '1.1.1.1', family: 4 }],
      request(options, callback) {
        const index = sent.length;
        sent.push(options);
        const req = new EventEmitter(),
          socket = new EventEmitter();
        sockets.push(socket);
        socket.encrypted = true;
        socket.authorized = true;
        socket.remoteAddress = '1.1.1.1';
        let closed = false,
          response,
          work;
        const close = () => {
          if (closed) return;
          closed = true;
          clearTimeout(work);
          response?.destroy();
          req.emit('close');
          if (!neverClose) socket.emit('close');
        };
        req.destroy = close;
        socket.destroy = close;
        req.end = () =>
          queueMicrotask(() => {
            const failure = failures[index] ?? null;
            req.emit('socket', socket);
            if (failure !== 'CERT_HAS_EXPIRED') socket.emit('secureConnect');
            const run = () => {
              if (closed) return;
              if (failure && failure !== 'BODY_RESET' && failure !== 'HTTP_503') {
                const error = new Error('SYNTHETIC_PRIVATE_ERROR_NEVER_PROJECTED');
                if (failure !== 'UNKNOWN') error.code = failure === 'SOCKET_RESET' ? 'ECONNRESET' : failure;
                if (failure === 'SOCKET_RESET') socket.emit('error', error);
                else req.emit('error', error);
                return;
              }
              response = new PassThrough();
              response.statusCode = failure === 'HTTP_503' ? 503 : 200;
              response.headers = { 'content-type': 'application/json' };
              response.rawHeaders = ['content-type', 'application/json'];
              response.complete = true;
              callback(response);
              if (expireDuringResponse && index === 1) queueMicrotask(() => f.setClock(instant + 15000));
              if (failure === 'BODY_RESET') {
                const error = new Error('SYNTHETIC_PRIVATE_BODY_ERROR');
                error.code = 'ECONNRESET';
                response.emit('error', error);
                return;
              }
              response.once('end', close);
              response.end(JSON.stringify(seed.metadata));
            };
            if (delays[index]) work = setTimeout(run, delays[index]);
            else run();
          });
        return req;
      },
    },
  );
  const f = nativeReaderFixture({
    transport,
    admitControlAttempt(admission, marker) {
      admissionCalls++;
      markers.push(marker);
      admissionValues.push(admission);
      if (admissionCalls === denyAdmissionAt) return false;
      charged.push(structuredClone(admission));
      if (admissionCalls === 2 && expireOnRetry) f.setClock(instant + 15000);
      if (admissionCalls === 2 && expireInRetryTurn) queueMicrotask(() => f.setClock(instant + 15000));
    },
  });
  return {
    ...f,
    transport,
    sent,
    charged,
    markers,
    admissionValues,
    admissionCalls: () => admissionCalls,
    close() {
      transport.close();
      for (const socket of sockets) socket.emit('close');
    },
  };
}

test('native reader retries one physically closed pre-response reset with a second durable GET admission', async () => {
  const f = nativeGetRetryFixture();
  try {
    const receipt = await f.reader.metadata(f.args);
    assert.equal(receipt.executionId, '101');
    assert.equal(f.sent.length, 2);
    assert.equal(f.charged.length, 2);
    assert.deepEqual(f.charged[1], f.charged[0]);
    assert.equal(f.admissionValues[1], f.admissionValues[0]);
    assert.equal(f.markers[0], undefined);
    assert.deepEqual(f.markers[1], { retryOfPreviousAttempt: true });
    assert.equal(Object.isFrozen(f.markers[1]), true);
    assert.equal(f.sent[1].method, 'GET');
    assert.equal(f.sent[1].path, f.sent[0].path);
    assert.equal(f.reader.state().requests, 2);
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
    assert.equal(f.reader.lastFailure(), null);
  } finally {
    f.close();
  }
});

test('native reader never retries a second reset certificate refusal unknown body HTTP or uncertain closure', async () => {
  for (const [failures, maximum, neverClose] of [
    [['ECONNRESET', 'ECONNRESET', null], 2, false],
    [['CERT_HAS_EXPIRED', null], 1, false],
    [['ECONNREFUSED', null], 1, false],
    [['UNKNOWN', null], 1, false],
    [['BODY_RESET', null], 1, false],
    [['HTTP_503', null], 1, false],
    [['ECONNRESET', null], 1, true],
  ]) {
    const f = nativeGetRetryFixture({ failures, neverClose });
    try {
      await assert.rejects(f.reader.metadata(f.args), fixed);
      assert.equal(f.sent.length, maximum);
      assert.equal(f.charged.length, maximum);
    } finally {
      f.close();
    }
  }
});

test('native reader permits the same one-retry rule for a genuine pre-response socket reset', async () => {
  const f = nativeGetRetryFixture({ failures: ['SOCKET_RESET', null] });
  try {
    const receipt = await f.reader.metadata(f.args);
    assert.equal(receipt.executionId, '101');
    assert.equal(f.sent.length, 2);
    assert.equal(f.charged.length, 2);
    assert.equal(f.admissionValues[1], f.admissionValues[0]);
    assert.deepEqual(f.markers[1], { retryOfPreviousAttempt: true });
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
  }
});

test('native reader reset retry refuses an exhausted second admission before another native HTTP send', async () => {
  const f = nativeGetRetryFixture({ denyAdmissionAt: 2 });
  try {
    await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_ADMISSION$/);
    assert.equal(f.admissionCalls(), 2);
    assert.equal(f.charged.length, 1);
    assert.equal(f.sent.length, 1);
    assert.equal(f.reader.state().requests, 1);
    assert.equal(f.reader.lastFailure().stage, 'admission');
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
  }
});

test('native reader reset retry consumes the existing eight metadata attempt allowance', async () => {
  const f = nativeGetRetryFixture({
    failures: [null, null, null, null, null, null, null, 'ECONNRESET', null],
  });
  try {
    for (let i = 0; i < 7; i++) await f.reader.metadata(f.args);
    await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_POLL_LIMIT$/);
    assert.equal(f.sent.length, 8);
    assert.equal(f.charged.length, 8);
  } finally {
    f.close();
  }
});

test('native reader reset retry checks the original deadline again after its second durable admission', async () => {
  const f = nativeGetRetryFixture({ expireOnRetry: true });
  try {
    await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_DEADLINE$/);
    assert.equal(f.sent.length, 1);
    assert.equal(f.charged.length, 2);
    assert.equal(f.reader.state().requests, 1);
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
  }
});

test('native reader reset retry fences the later transport microtask against the original logical deadline', async () => {
  const f = nativeGetRetryFixture({ expireInRetryTurn: true });
  try {
    await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_DEADLINE$/);
    assert.equal(f.sent.length, 1);
    assert.equal(f.charged.length, 2);
    assert.equal(f.reader.state().requests, 2);
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
  }
});

test('native reader reset retry never returns a receipt after processing crosses the logical deadline', async () => {
  const f = nativeGetRetryFixture({ expireDuringResponse: true });
  try {
    await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_DEADLINE$/);
    assert.equal(f.sent.length, 2);
    assert.equal(f.charged.length, 2);
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
  }
});

test('native reader transport cause remains private branded and cannot grant retry to a borrowed error wrapper', async () => {
  const f = nativeGetRetryFixture({ failures: ['ECONNRESET', 'ECONNRESET'] });
  try {
    const error = await f.reader.metadata(f.args).catch((value) => value);
    const cause = nativeReader.foundationNativeReaderTransportCause(error);
    assert.deepEqual(cause, {
      transportCode: 'REQUEST',
      nativeOSCode: 'ECONNRESET',
      origin: 'request_error',
      responseSeen: false,
      tlsVerified: true,
      physicalClosureVerified: true,
    });
    assert.equal(Object.isFrozen(cause), true);
    let unsafeReads = 0,
      requests = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          unsafeReads++;
          throw Error('SYNTHETIC_PRIVATE');
        },
        getPrototypeOf() {
          unsafeReads++;
          throw Error('SYNTHETIC_PRIVATE');
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [{ ...error }, Object.create(error), hostile, revoked.proxy, null, 'ECONNRESET'])
      assert.equal(nativeReader.foundationNativeReaderTransportCause(value), null);
    const wrapper = {
      request() {
        requests++;
        return Promise.reject(error);
      },
    };
    Object.defineProperty(wrapper, 'state', {
      get() {
        unsafeReads++;
        throw Error('SYNTHETIC_PRIVATE');
      },
    });
    const unbranded = nativeReaderFixture({ transport: wrapper });
    await assert.rejects(
      unbranded.reader.metadata(unbranded.args),
      /^Error: FOUNDATION_NATIVE_TRANSPORT_REQUEST$/,
    );
    assert.equal(requests, 1);
    assert.equal(unsafeReads, 0);
  } finally {
    f.close();
  }
});

test('native reader reset retry shares one logical15second deadline instead of renewing its timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = nativeGetRetryFixture({ delays: [10000, 10000] });
  try {
    const result = f.reader.metadata(f.args).catch((error) => error);
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(10000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.sent.length, 2);
    t.mock.timers.tick(5000);
    await new Promise((resolve) => setImmediate(resolve));
    const error = await result;
    assert.match(String(error), /^Error: FOUNDATION_NATIVE_(?:TRANSPORT_)?DEADLINE$/);
    assert.equal(f.sent.length, 2);
    assert.equal(f.charged.length, 2);
    assert.deepEqual(f.transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  } finally {
    f.close();
    t.mock.timers.reset();
  }
});

test('native reader error-code getter projects only genuine private errors without inspecting hostile values', async () => {
  const f = nativeReaderFixture(),
    key = 'WF-32',
    id = f.bindings.workflowRefs[key].id,
    path = '/api/v1/executions?workflowId=' + id + '&includeData=false&limit=120';
  f.answers.set(path, () =>
    f.wire(
      {},
      {
        body: (async function* () {
          yield Buffer.from('{');
        })(),
      },
    ),
  );
  const error = await f.reader.discover({ workflowKey: key, baselineIds: [] }).catch((e) => e);
  assert.equal(typeof nativeReader.foundationNativeReaderErrorCode, 'function');
  assert.equal(nativeReader.foundationNativeReaderErrorCode(error), 'JSON');
  let privateReads = 0;
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_PROTOTYPE');
      },
      get() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_GETTER');
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const getters = Object.create(null);
  Object.defineProperty(getters, 'message', {
    get() {
      privateReads++;
      throw Error('SYNTHETIC_PRIVATE_GETTER');
    },
  });
  for (const value of [
    hostile,
    revoked.proxy,
    getters,
    Object.create(error),
    new Error('FOUNDATION_NATIVE_JSON'),
    null,
    1,
    'JSON',
  ])
    assert.equal(nativeReader.foundationNativeReaderErrorCode(value), null);
  assert.equal(privateReads, 0);
});

test('native reader preserves genuine private transport DNS classification without exposing resolver errors', async () => {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  let sends = 0;
  const transport = createFoundationNativeTransport(
    { apiKey: secret, bindings, authorizeExecution: () => false },
    {
      resolveInstance: async () => {
        throw Error('SYNTHETIC_PRIVATE_DNS_' + secret);
      },
      request: () => {
        sends++;
        throw Error('NO_SEND');
      },
    },
  );
  const f = nativeReaderFixture({ transport });
  await assert.rejects(
    f.reader.discover({ workflowKey: 'WF-32', baselineIds: [] }),
    /^Error: FOUNDATION_NATIVE_TRANSPORT_DNS$/,
  );
  assert.deepEqual(f.reader.lastFailure(), {
    version: 1,
    workflowKey: 'WF-32',
    operation: 'discovery',
    stage: 'request',
    classification: 'unknown',
    code: 'TRANSPORT_DNS',
    httpStatus: null,
  });
  assert.doesNotMatch(JSON.stringify(f.reader.lastFailure()), /SYNTHETIC|PRIVATE|123456|message|body|https/);
  assert.equal(sends, 0);
  assert.equal(f.admissions(), 1);
  assert.deepEqual(transport.state(), { pendingRequests: 0, unclosedResponses: 0 });
  transport.close();
});

test('native discovery keeps a fixed safe last failure with actual HTTP status and owned workflow only', async () => {
  const f = nativeReaderFixture(),
    key = 'WF-70',
    id = f.bindings.workflowRefs[key].id;
  const path = '/api/v1/executions?workflowId=' + id + '&includeData=false&limit=120';
  f.answers.set(path, () => f.wire({ data: [], nextCursor: null }));
  f.answers.set(path + '&status=running', () =>
    f.wire({
      data: [
        {
          id: '501',
          workflowId: id,
          mode: 'SYNTHETIC_PRIVATE_MODE',
          status: 'running',
          startedAt: null,
          stoppedAt: null,
          waitTill: null,
        },
      ],
      nextCursor: null,
    }),
  );
  assert.equal(f.reader.lastFailure(), null);
  await assert.rejects(f.reader.discover({ workflowKey: key, baselineIds: [] }), fixed);
  const diagnostic = f.reader.lastFailure();
  assert.deepEqual(diagnostic, {
    version: 1,
    workflowKey: key,
    operation: 'discovery',
    stage: 'projection',
    classification: 'contract',
    code: 'METADATA',
    httpStatus: 200,
  });
  assert.equal(Object.isFrozen(diagnostic), true);
  assert.doesNotMatch(JSON.stringify(diagnostic), /SYNTHETIC|501|https|message|body|cursor/);
  f.answers.set(path + '&status=running', () => f.wire({ data: [], nextCursor: null }));
  await f.reader.discover({ workflowKey: key, baselineIds: [] });
  assert.deepEqual(f.reader.lastFailure(), diagnostic);
});

test('native reader diagnostics distinguish obtained HTTP rejection from unknown transport failure without reading raw errors', async () => {
  const f = nativeReaderFixture(),
    key = 'WF-70',
    id = f.bindings.workflowRefs[key].id;
  const path = '/api/v1/executions?workflowId=' + id + '&includeData=false&limit=120';
  f.answers.set(path, () => f.wire({ message: 'SYNTHETIC_PRIVATE_BODY' }, { status: 429 }));
  await assert.rejects(f.reader.discover({ workflowKey: key, baselineIds: [] }), fixed);
  assert.deepEqual(f.reader.lastFailure(), {
    version: 1,
    workflowKey: key,
    operation: 'discovery',
    stage: 'http_status',
    classification: 'http',
    code: 'DISCOVERY',
    httpStatus: 429,
  });
  let privateReads = 0;
  const raw = Object.create(null);
  for (const field of ['message', 'code', 'body'])
    Object.defineProperty(raw, field, {
      get() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_ERROR');
      },
    });
  f.answers.set(path, () => {
    throw raw;
  });
  await assert.rejects(f.reader.discover({ workflowKey: key, baselineIds: [] }), fixed);
  assert.deepEqual(f.reader.lastFailure(), {
    version: 1,
    workflowKey: key,
    operation: 'discovery',
    stage: 'request',
    classification: 'unknown',
    code: 'REJECTED',
    httpStatus: null,
  });
  assert.equal(privateReads, 0);
});

test('native reader error branding never traverses hostile or revoked Proxy prototypes or error getters', async () => {
  const f = nativeReaderFixture(),
    key = 'WF-32',
    id = f.bindings.workflowRefs[key].id,
    path = '/api/v1/executions?workflowId=' + id + '&includeData=false&limit=120';
  let privateReads = 0;
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_PROTOTYPE');
      },
      get() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_GETTER');
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const getters = Object.create(null);
  for (const field of ['message', 'code', 'body'])
    Object.defineProperty(getters, field, {
      get() {
        privateReads++;
        throw Error('SYNTHETIC_PRIVATE_GETTER');
      },
    });
  for (const value of [hostile, revoked.proxy, getters]) {
    f.answers.set(path, () => {
      throw value;
    });
    await assert.rejects(
      f.reader.discover({ workflowKey: key, baselineIds: [] }),
      /^Error: FOUNDATION_NATIVE_REJECTED$/,
    );
    assert.deepEqual(f.reader.lastFailure(), {
      version: 1,
      workflowKey: key,
      operation: 'discovery',
      stage: 'request',
      classification: 'unknown',
      code: 'REJECTED',
      httpStatus: null,
    });
    assert.equal(privateReads, 0);
  }
});

for (const failure of ['JSON', 'METADATA'])
  test(`native reader preserves first fixed ${failure} failure when response closure also rejects`, async () => {
    const f = nativeReaderFixture();
    let privateReads = 0,
      aborted = false;
    const raw = Object.create(null);
    for (const key of ['message', 'code', 'stack', 'body'])
      Object.defineProperty(raw, key, {
        get() {
          privateReads++;
          throw Error(secret);
        },
      });
    f.answers.set('/api/v1/executions/101?includeData=false', () => {
      const closed = Promise.reject(raw);
      closed.catch(() => {});
      return f.wire(
        { ...f.metadata, workflowVersionId: undefined },
        {
          ...(failure === 'JSON'
            ? {
                body: (async function* () {
                  yield Buffer.from('{');
                })(),
              }
            : {}),
          closed,
          abort() {
            aborted = true;
          },
        },
      );
    });
    await assert.rejects(f.reader.metadata(f.args), new RegExp('^Error: FOUNDATION_NATIVE_' + failure + '$'));
    assert.deepEqual(f.reader.lastFailure(), {
      version: 1,
      workflowKey: 'WF-00',
      operation: 'metadata',
      stage: failure === 'JSON' ? 'parse' : 'projection',
      classification: failure === 'JSON' ? 'parse' : 'contract',
      code: failure,
      httpStatus: 200,
    });
    assert.equal(aborted, true);
    assert.equal(privateReads, 0);
    assert.equal(f.reader.state().unclosedResponses, 1, 'unconfirmed closure remains blocking');
    assert.equal(f.reader.state().pendingRequests, 0);
    assert.doesNotMatch(JSON.stringify(f.reader.lastFailure()), /SYNTHETIC|PRIVATE|123456|body|message/);
  });

test('native reader still refuses valid metadata when response closure alone rejects', async () => {
  const f = nativeReaderFixture();
  f.answers.set('/api/v1/executions/101?includeData=false', () => {
    const closed = Promise.reject(Error(secret));
    closed.catch(() => {});
    return f.wire(f.metadata, { closed });
  });
  await assert.rejects(f.reader.metadata(f.args), /^Error: FOUNDATION_NATIVE_CLOSE$/);
  assert.deepEqual(f.reader.lastFailure(), {
    version: 1,
    workflowKey: 'WF-00',
    operation: 'metadata',
    stage: 'close',
    classification: 'closure',
    code: 'CLOSE',
    httpStatus: 200,
  });
  assert.equal(f.reader.state().unclosedResponses, 1);
});

test('metadata is one request; full read reuses fresh branded metadata and emits only safe fields', async () => {
  const f = nativeReaderFixture();
  assert.equal(assertFoundationNativeReader(f.reader), f.reader);
  const m = await f.reader.metadata(f.args);
  assert.equal(assertFoundationNativeMetadataReceipt(m), m);
  assert.equal(f.calls.length, 1);
  const r = await f.reader.read({ ...f.args, metadataReceipt: m });
  assert.equal(f.calls.length, 3);
  assert.equal(assertFoundationNativeReceipt(r), r);
  assert.equal(r.kind, 'foundation_native_receipt');
  assert.equal(r.privacyChecked, true);
  assert.equal(r.transportClosed, true);
  assert.equal(r.bodyHash, f.binding.bodyHash);
  assert.equal(r.nativeChildren[0].executionId, '102');
  assert.equal(r.nativeChildren[0].key, 'WF-10');
  assert.equal(Object.isFrozen(r.nativeChildren[0]), true);
  assert.equal(JSON.stringify(r).includes('safe'), false);
  for (const key of ['data', 'workflowData', 'body', 'error', 'headers'])
    assert.equal(Object.hasOwn(r, key), false);
  assert.throws(() => assertFoundationNativeReceipt({ ...r }), fixed);
  assert.throws(() => assertFoundationNativeMetadataReceipt({ ...m }), fixed);
});

test('native persisted snapshot omits active-version and pins while exact top-level version/body checks remain mandatory', async () => {
  const f = nativeReaderFixture();
  assert.deepEqual(Object.keys(f.full.workflowData).sort(), [
    'connections',
    'id',
    'name',
    'nodes',
    'settings',
  ]);
  assert.equal(Object.hasOwn(f.full.workflowData, 'activeVersionId'), false);
  assert.equal(Object.hasOwn(f.full.workflowData, 'pinData'), false);
  const proof = await f.reader.read(f.args);
  assert.equal(proof.bodyHash, f.binding.bodyHash);
  f.full.workflowVersionId = 'wrong-native-version';
  await assert.rejects(f.reader.read(f.args), fixed);
});

test('executed snapshots accept only source-derived native parameter defaults while the current saved body stays exact', async () => {
  const f = nativeReaderFixture();
  const sourceBefore = structuredClone(f.binding.body);
  f.full.workflowData = {
    id: f.workflow.id,
    ...foundationRuntimeExecutionParameterCandidates(f.binding.body).nativeDefaults,
  };
  const snapshotBefore = structuredClone(f.full.workflowData);
  assert.equal((await f.reader.read(f.args)).bodyHash, f.binding.bodyHash);
  assert.deepEqual(f.binding.body, sourceBefore);
  assert.deepEqual(f.full.workflowData, snapshotBefore);
  for (const mutate of [
    (g) => {
      g.full.workflowData.nodes[0].parameters.operation = 'SYNTHETIC_UNKNOWN_OPERATION';
    },
    (g) => {
      g.full.workflowData.nodes[0].parameters.unknown = true;
    },
    (g) => {
      g.full.workflowData.nodes[0].credentials = { httpHeaderAuth: { id: 'other', name: 'other' } };
    },
    (g) => {
      g.workflow.nodes[0].parameters.operation = 'call_workflow';
    },
  ]) {
    const g = nativeReaderFixture();
    g.full.workflowData = {
      id: g.workflow.id,
      ...structuredClone(foundationRuntimeExecutionParameterCandidates(g.binding.body).nativeDefaults),
    };
    mutate(g);
    await assert.rejects(g.reader.read(g.args), fixed);
  }
});

test('native Set output expansion needs a nonempty actual task for the sole known Set node', async () => {
  function fixture(withTask) {
    const f = nativeReaderFixture();
    const node = {
      id: 'set',
      name: 'Known Set',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [0, 0],
      parameters: {
        mode: 'manual',
        includeOtherFields: false,
        assignments: { assignments: [] },
        options: {},
      },
    };
    for (const body of [f.binding.body, f.workflow]) body.nodes.push(structuredClone(node));
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    f.full.workflowData = {
      id: f.workflow.id,
      ...foundationRuntimeExecutionParameterCandidates(f.binding.body).nativeDefaultsAndSetOutput,
    };
    if (withTask) f.full.data.resultData.runData[node.name] = [{ data: { main: [[{ json: {} }]] } }];
    return f;
  }
  const good = fixture(true);
  assert.equal((await good.reader.read(good.args)).bodyHash, good.binding.bodyHash);
  for (const tasks of [undefined, [], null, {}]) {
    const bad = fixture(false);
    if (tasks !== undefined) bad.full.data.resultData.runData['Known Set'] = tasks;
    await assert.rejects(bad.reader.read(bad.args), fixed);
  }
});

test('technical16 cleanup cannot qualify caller-built booleans or an ordinary live receipt', async () => {
  const f = nativeReaderFixture();
  for (const context of [
    {},
    {
      kind: 'm03_technical16_cleanup_context',
      qualifiedSideEffects: true,
      executionIds: ['31131', '31130'],
      canonicalWorkflowsVerified: 25,
      settled: true,
    },
  ]) {
    await assert.rejects(
      f.reader.qualifyTechnical16Cleanup({ context }),
      /FOUNDATION_NATIVE_CLEANUP_CONTEXT/,
    );
  }
  assert.equal(f.calls.length, 0);
  const ordinary = await f.reader.read(f.args);
  assert.throws(
    () => assertFoundationTechnical16CleanupQualification(ordinary),
    /FOUNDATION_NATIVE_CLEANUP_QUALIFICATION/,
  );
  assert.throws(
    () =>
      assertFoundationTechnical16CleanupQualification(
        Object.freeze({ ...ordinary, kind: 'foundation_technical16_cleanup_qualification' }),
      ),
    /FOUNDATION_NATIVE_CLEANUP_QUALIFICATION/,
  );
});

test('pinned native mode is checked separately on current graph and executed snapshot', async () => {
  const f = nativeReaderFixture();
  f.binding.nativeReadonlySettings = { binaryMode: 'separate' };
  f.workflow.settings.binaryMode = 'separate';
  f.full.workflowData.settings.binaryMode = 'separate';
  const receipt = await f.reader.read(f.args);
  assert.equal(receipt.bodyHash, f.binding.bodyHash);
  assert.equal(Object.hasOwn(receipt, 'nativeReadonlySettings'), false);
  for (const [target, value] of [
    ['workflow', 'combined'],
    ['workflow', undefined],
    ['snapshot', 'combined'],
    ['snapshot', 'SYNTHETIC_PRIVATE_MODE'],
    ['binding', 'combined'],
  ]) {
    const denied = nativeReaderFixture();
    denied.binding.nativeReadonlySettings = { binaryMode: 'separate' };
    denied.workflow.settings.binaryMode = 'separate';
    denied.full.workflowData.settings.binaryMode = 'separate';
    if (target === 'binding') denied.binding.nativeReadonlySettings.binaryMode = value;
    else {
      const settings = target === 'workflow' ? denied.workflow.settings : denied.full.workflowData.settings;
      if (value === undefined) delete settings.binaryMode;
      else settings.binaryMode = value;
    }
    await assert.rejects(denied.reader.read(denied.args), fixed);
  }
});

test('actual supplied pin data cannot masquerade as owned manual execution output', async () => {
  for (const pins of [{ 'Known call': [{ json: { synthetic: true } }] }, { 'Unused node': [] }, null, []]) {
    const f = nativeReaderFixture();
    f.full.data.resultData.pinData = pins;
    await assert.rejects(f.reader.read(f.args), fixed);
  }
  const empty = nativeReaderFixture();
  empty.full.data.resultData.pinData = {};
  assert.equal((await empty.reader.read(empty.args)).privacyChecked, true);
});

test('native empty ManualTrigger bootstrap pin is the sole allowed nonempty pin map', async () => {
  const manual = {
    id: 'manual',
    name: 'Manual case',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  };
  function fixture() {
    const f = nativeReaderFixture();
    for (const body of [f.binding.body, f.workflow, f.full.workflowData]) {
      body.nodes.unshift(structuredClone(manual));
      body.settings.availableInMCP = true;
    }
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    f.full.data.resultData.pinData = { [manual.name]: [{ json: {} }] };
    return f;
  }
  const native = fixture();
  assert.equal((await native.reader.read(native.args)).privacyChecked, true);
  const sub = fixture();
  for (const body of [sub.binding.body, sub.workflow, sub.full.workflowData])
    body.nodes.push({
      id: 'when-called',
      name: 'When called',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [0, 0],
      parameters: {},
    });
  sub.binding.bodyHash = runtimeGraphHash(sub.binding.body);
  assert.equal((await sub.reader.read(sub.args)).privacyChecked, true);
  for (const change of [
    (f) => {
      f.full.data.resultData.pinData[manual.name] = [{ json: { supplied: true } }];
    },
    (f) => {
      f.full.data.resultData.pinData[manual.name].push({ json: {} });
    },
    (f) => {
      f.full.data.resultData.pinData[manual.name][0].pairedItem = 0;
    },
    (f) => {
      f.full.data.resultData.pinData['Known call'] = [{ json: {} }];
    },
    (f) => {
      f.full.mode = f.metadata.mode = 'integrated';
    },
    (f) => {
      for (const body of [f.binding.body, f.workflow, f.full.workflowData])
        body.settings.availableInMCP = false;
      f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    },
    (f) => {
      for (const body of [f.binding.body, f.workflow, f.full.workflowData]) body.nodes[0].disabled = true;
      f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    },
    (f) => {
      for (const body of [f.binding.body, f.workflow, f.full.workflowData])
        body.nodes.push({ ...manual, id: 'manual2', name: 'Other manual' });
      f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    },
    (f) => {
      for (const body of [f.binding.body, f.workflow, f.full.workflowData])
        body.nodes.push({ ...manual, id: 'hook', name: 'Other hook', type: 'n8n-nodes-base.webhook' });
      f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    },
  ]) {
    const f = fixture();
    change(f);
    await assert.rejects(f.reader.read(f.args), fixed);
  }
});

test('nullable browser manual pins require the sole reviewed empty ManualTrigger output', async () => {
  function fixture() {
    const f = nativeReaderFixture(),
      manual = {
        id: 'manual-null',
        name: 'Manual nullable case',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      };
    for (const body of [f.binding.body, f.workflow, f.full.workflowData]) {
      body.nodes.unshift(structuredClone(manual));
      body.settings.availableInMCP = true;
    }
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    f.full.data.resultData.pinData = null;
    f.full.data.resultData.runData[manual.name] = [
      { data: { main: [[{ json: {}, pairedItem: { item: 0 } }]] } },
    ];
    return { f, manual };
  }
  const { f } = fixture();
  assert.equal((await f.reader.read(f.args)).privacyChecked, true);
  for (const change of [
    (f) => {
      f.full.mode = f.metadata.mode = 'integrated';
    },
    (f) => {
      for (const b of [f.binding.body, f.workflow, f.full.workflowData]) b.settings.availableInMCP = false;
    },
    (f) => {
      for (const b of [f.binding.body, f.workflow, f.full.workflowData]) b.nodes[0].disabled = true;
    },
    (f, m) => {
      for (const b of [f.binding.body, f.workflow, f.full.workflowData])
        b.nodes.push({ ...m, id: 'extra-hook', name: 'Other webhook', type: 'n8n-nodes-base.webhook' });
    },
    (f, m) => {
      delete f.full.data.resultData.runData[m.name];
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].data.main[0][0].json = { supplied: true };
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].data.main[0][0].pairedItem = { item: 1 };
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].data.main[0][0].binary = { supplied: true };
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].data.main[0].push({ json: {} });
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].data.main.push([{ json: {} }]);
    },
    (f, m) => {
      f.full.data.resultData.runData[m.name][0].error = { message: 'synthetic' };
    },
    (f) => {
      f.full.data.redactionInfo = { isRedacted: true };
    },
    (f) => {
      f.full.workflowData.name = 'unreviewed';
    },
    (f) => {
      f.full.workflowVersionId = 'unreviewed';
    },
  ]) {
    const { f, manual } = fixture();
    change(f, manual);
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    await assert.rejects(f.reader.read(f.args), fixed);
  }
});

test('technical22 cleanup qualification refuses caller-shaped context and copied receipt authority before reads', async () => {
  const f = nativeReaderFixture();
  for (const context of [
    {},
    { kind: 'm03_technical22_cleanup_context', technicalAttempt: 22, executionIds: ['31145'] },
    Object.freeze({ kind: 'm03_technical22_cleanup_context', technicalAttempt: 22 }),
  ]) {
    await assert.rejects(
      () => f.reader.qualifyTechnical22Cleanup({ context }),
      /FOUNDATION_NATIVE_CLEANUP_CONTEXT/,
    );
  }
  for (const q of [
    {},
    Object.freeze({
      kind: 'foundation_technical22_cleanup_qualification',
      executionIds: ['31145'],
      records: [],
    }),
  ])
    assert.throws(
      () => nativeReader.assertFoundationTechnical22CleanupQualification(q),
      /FOUNDATION_NATIVE_CLEANUP_QUALIFICATION/,
    );
  assert.equal(f.calls.length, 0);
});

test('read authenticates fresh current and executed body/version; missing thrown-call link is not invented', async () => {
  const f = nativeReaderFixture();
  f.full.status = f.metadata.status = 'error';
  f.full.data = {
    parentExecution: {
      executionId: '99',
      workflowId: f.bindings.workflowRefs['WF-99'].id,
      shouldResume: true,
    },
    resultData: { runData: {}, error: { message: 'synthetic public failure' } },
  };
  const r = await f.reader.read(f.args);
  assert.equal(r.status, 'error');
  assert.deepEqual(r.nativeChildren, []);
  assert.equal(r.nativeParent.executionId, '99');
  assert.equal(r.nativeParent.key, 'WF-99');
  for (const change of [
    (x) => {
      x.full.workflowData.nodes[0].parameters.workflowId.value = 'foreign';
    },
    (x) => {
      x.full.workflowVersionId = 'different';
    },
    (x) => {
      x.workflow.versionId = 'different';
    },
    (x) => {
      x.binding.activeVersionId = 'different';
    },
    (x) => {
      delete x.full.data.resultData.runData;
    },
    (x) => {
      x.full.dataTooLargeToDisplay = true;
    },
  ]) {
    const x = nativeReaderFixture();
    change(x);
    await assert.rejects(x.reader.read(x.args), fixed);
  }
});

test('stream refuses oversize, truncated JSON, malformed UTF8 and native incomplete-body flags', async () => {
  for (const answer of [
    () => ({
      status: 200,
      body: (async function* () {
        yield Buffer.alloc(foundationNativeReaderLimits.responseBytes + 1, 32);
      })(),
      closed: Promise.resolve(),
    }),
    () => ({
      status: 200,
      body: (async function* () {
        yield Buffer.from('{');
      })(),
      closed: Promise.resolve(),
    }),
    () => ({
      status: 200,
      body: (async function* () {
        yield Uint8Array.from([0xc3, 0x28]);
      })(),
      closed: Promise.resolve(),
    }),
    () => ({
      status: 200,
      headers: { 'content-length': '9000000' },
      body: (async function* () {
        throw Error('must not read');
      })(),
      closed: Promise.resolve(),
    }),
  ]) {
    const f = nativeReaderFixture();
    f.answers.set('/api/v1/executions/101?includeData=false', answer);
    await assert.rejects(f.reader.metadata(f.args), fixed);
  }
});

test('private reflection is rejected across chunks, escaped JSON values and property names', async () => {
  for (const make of [
    (f) => JSON.stringify({ ...f.metadata, extra: secret }),
    (f) =>
      JSON.stringify({ ...f.metadata, extra: secret }).replace(
        secret,
        [...secret].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
      ),
    (f) => JSON.stringify({ ...f.metadata, [secret]: 'value' }),
    (f) => JSON.stringify({ ...f.metadata, extra: encodeURIComponent(secret) }),
  ]) {
    const f = nativeReaderFixture();
    const bytes = Buffer.from(make(f));
    f.answers.set('/api/v1/executions/101?includeData=false', () => ({
      status: 200,
      body: (async function* () {
        for (let i = 0; i < bytes.length; i += 3) yield bytes.subarray(i, i + 3);
      })(),
      closed: Promise.resolve(),
    }));
    await assert.rejects(f.reader.metadata(f.args), fixed);
  }
});

test('discovery uses owned workflow/default+running filters without start-time exclusion', async () => {
  const f = nativeReaderFixture();
  const path = '/api/v1/executions?workflowId=' + f.binding.workflowId + '&includeData=false&limit=120';
  const queued = { ...f.metadata, id: '103', status: 'new', startedAt: null, stoppedAt: null };
  f.answers.set(path, () => f.wire({ data: [f.metadata, queued], nextCursor: null }));
  f.answers.set(path + '&status=running', () => f.wire({ data: [], nextCursor: null }));
  const r = await f.reader.discover({ workflowKey: f.workflowKey, baselineIds: ['101'] });
  assert.deepEqual(
    r.candidates.map((x) => x.executionId),
    ['103'],
  );
  assert.equal(r.candidates[0].startedAt, null);
  assert.equal(r.adoptionProven, false);
  assert.equal(r.drainProven, false);
  assert.equal(f.calls.length, 2);
  assert.equal(
    f.calls.every((x) => !x.path.includes('startedAfter')),
    true,
  );
});

test('native list rows lacking selected version/creation fields remain candidates, never version or completion proof', async () => {
  const f = nativeReaderFixture();
  const row = { ...f.metadata, status: 'new', startedAt: null, stoppedAt: null, waitTill: null };
  delete row.workflowVersionId;
  delete row.createdAt;
  const path = '/api/v1/executions?workflowId=' + f.binding.workflowId + '&includeData=false&limit=120';
  f.answers.set(path, () => f.wire({ data: [row], nextCursor: null }));
  f.answers.set(path + '&status=running', () => f.wire({ data: [], nextCursor: null }));
  const discovery = await f.reader.discover({ workflowKey: f.workflowKey, baselineIds: [] });
  const candidate = discovery.candidates[0];
  assert.equal(candidate.versionId, null);
  assert.equal(candidate.createdAt, null);
  assert.equal(candidate.startedAt, null);
  assert.equal(discovery.adoptionProven, false);
  assert.throws(() => assertFoundationNativeMetadataReceipt(candidate), fixed);
  assert.throws(() => assertFoundationNativeReceipt(candidate), fixed);
  await assert.rejects(f.reader.read({ ...f.args, metadataReceipt: candidate }), fixed);
  f.answers.set('/api/v1/executions/101?includeData=false', () => f.wire(row));
  await assert.rejects(f.reader.metadata(f.args), fixed);
  const malformed = nativeReaderFixture();
  const badPath =
    '/api/v1/executions?workflowId=' + malformed.binding.workflowId + '&includeData=false&limit=120';
  malformed.answers.set(badPath, () =>
    malformed.wire({ data: [{ ...row, workflowVersionId: {} }], nextCursor: null }),
  );
  await assert.rejects(
    malformed.reader.discover({ workflowKey: malformed.workflowKey, baselineIds: [] }),
    fixed,
  );
});

test('privacy cap accepts representative nested one-page success and failure under8MiB', async () => {
  for (const failure of [false, true]) {
    const f = nativeReaderFixture();
    const page = 'Public page ' + '.'.repeat(256 * 1024 - 12);
    const extraNode = {
      id: 'nested',
      name: 'Nested public copies',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1, 0],
      parameters: { jsCode: 'return items;' },
    };
    for (const body of [f.binding.body, f.workflow, f.full.workflowData])
      body.nodes.push(structuredClone(extraNode));
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    f.full.data.resultData.runData['Known call'][0].data.main[0][0].json = { markdown: page };
    f.full.data.resultData.runData['Nested public copies'] = [
      { data: { main: [Array.from({ length: 24 }, () => ({ json: { markdown: page } }))] } },
    ];
    if (failure) {
      f.full.status = f.metadata.status = 'error';
      f.full.data.resultData.error = {
        message: 'public request failed',
        context: { data: { copies: [page, page, page, page] } },
      };
    }
    assert.equal(Buffer.byteLength(page), 256 * 1024);
    assert.ok(Buffer.byteLength(JSON.stringify(f.full)) < foundationNativeReaderLimits.responseBytes);
    assert.ok(Buffer.byteLength(JSON.stringify(f.full)) > 6 * 1024 * 1024);
    const r = await f.reader.read(f.args);
    assert.equal(r.privacyChecked, true);
    assert.equal(JSON.stringify(r).includes('Public page'), false);
  }
});

test('timed-out unresolved transport stays pending and late response is aborted before payload read', async () => {
  let release;
  let aborted = false;
  const f = nativeReaderFixture({
    deadlineAt: instant + 5,
    transport: {
      request: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  });
  await assert.rejects(f.reader.metadata(f.args), fixed);
  assert.equal(f.reader.state().pendingRequests, 1);
  release(
    f.wire(f.metadata, {
      abort: () => {
        aborted = true;
      },
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(aborted, true);
  assert.equal(f.reader.state().pendingRequests, 0);
});

test('unclosed response refuses a receipt and remains unclosed until actual promise settlement', async () => {
  let close;
  const f = nativeReaderFixture({ deadlineAt: instant + 5 });
  f.answers.set('/api/v1/executions/101?includeData=false', () =>
    f.wire(f.metadata, {
      closed: new Promise((resolve) => {
        close = resolve;
      }),
    }),
  );
  await assert.rejects(f.reader.metadata(f.args), fixed);
  assert.equal(f.reader.state().unclosedResponses, 1);
  close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.reader.state().unclosedResponses, 0);
});

test('eight metadata attempts are shared across polling and read; async admission performs zero requests', async () => {
  const f = nativeReaderFixture();
  let m;
  for (let i = 0; i < 8; i++) m = await f.reader.metadata(f.args);
  await assert.rejects(f.reader.metadata(f.args), fixed);
  await f.reader.read({ ...f.args, metadataReceipt: m });
  assert.equal(f.calls.length, 10);
  const bad = nativeReaderFixture({ admitControlAttempt: () => Promise.reject(Error(secret)) });
  await assert.rejects(bad.reader.metadata(bad.args), fixed);
  assert.equal(bad.calls.length, 0);
});

test('reused metadata cannot bypass intent, age, mode or reader identity fences', async () => {
  for (const change of [
    (f, m) => ({ ...f.args, metadataReceipt: m, intentAt: instant + 40000 }),
    (f, m) => {
      f.setClock(instant + 15001);
      return { ...f.args, metadataReceipt: m };
    },
    (f, m) => ({ ...f.args, metadataReceipt: m, expectedMode: 'error' }),
    (f, m) => ({ ...f.args, metadataReceipt: { ...m } }),
  ]) {
    const f = nativeReaderFixture();
    const m = await f.reader.metadata(f.args);
    await assert.rejects(f.reader.read(change(f, m)), fixed);
  }
});

test('discovery refuses truncated pagination, unowned candidates, changed duplicates and missing baseline', async () => {
  for (const mode of ['pagination', 'unowned', 'changed']) {
    const f = nativeReaderFixture();
    const base = '/api/v1/executions?workflowId=' + f.binding.workflowId + '&includeData=false&limit=120';
    const row = { ...f.metadata };
    if (mode === 'unowned') row.workflowId = 'foreign';
    f.answers.set(base, () => f.wire({ data: [row], nextCursor: mode === 'pagination' ? 'next-a' : null }));
    f.answers.set(base + '&cursor=next-a', () => f.wire({ data: [], nextCursor: 'next-b' }));
    f.answers.set(base + '&status=running', () =>
      f.wire({
        data: mode === 'changed' ? [{ ...row, status: 'running', stoppedAt: null }] : [],
        nextCursor: null,
      }),
    );
    await assert.rejects(f.reader.discover({ workflowKey: f.workflowKey, baselineIds: [] }), fixed);
  }
  const f = nativeReaderFixture();
  await assert.rejects(f.reader.discover({ workflowKey: f.workflowKey }), fixed);
});

test('cleanup reducer accepts exact numeric DELETE acknowledgement and closed404, never raw DTOs', async () => {
  const f = nativeReaderFixture();
  const receipt = await f.reader.read(f.args);
  const signal = new AbortController().signal;
  const ack = await f.reader.cleanupResponse({
    response: f.wire({ ...f.metadata, id: 101 }),
    receipt,
    operation: 'delete_ack',
    signal,
  });
  assert.equal(ack.acknowledged, true);
  assert.equal(ack.executionId, '101');
  assert.equal(Object.hasOwn(ack, 'data'), false);
  const absent = await f.reader.cleanupResponse({
    response: f.wire({ message: 'not found' }, { status: 404 }),
    receipt,
    operation: 'absence',
    signal,
  });
  assert.equal(absent.absent, true);
  assert.equal(absent.transportClosed, true);
  for (const bad of [
    { ...f.metadata, id: '101' },
    { ...f.metadata, id: 102 },
    { ...f.metadata, id: 9007199254740992 },
    { ...f.metadata, id: 101, workflowVersionId: 'different' },
    { ...f.metadata, id: 101, message: secret },
  ])
    await assert.rejects(
      f.reader.cleanupResponse({ response: f.wire(bad), receipt, operation: 'delete_ack', signal }),
      fixed,
    );
  await assert.rejects(
    f.reader.cleanupResponse({
      response: f.wire({ message: secret }, { status: 404 }),
      receipt,
      operation: 'absence',
      signal,
    }),
    fixed,
  );
});

test('cleanup reducer has its own bounded closure timer and releases operation guard on failure', async () => {
  const f = nativeReaderFixture();
  const receipt = await f.reader.read(f.args);
  f.setClock(instant + 59995);
  let close;
  const signal = new AbortController().signal;
  await assert.rejects(
    f.reader.cleanupResponse({
      response: f.wire(
        { ...f.metadata, id: 101 },
        {
          closed: new Promise((r) => {
            close = r;
          }),
        },
      ),
      receipt,
      operation: 'delete_ack',
      signal,
    }),
    fixed,
  );
  assert.equal(f.reader.state().busy, false);
  assert.equal(f.reader.state().unclosedResponses, 1);
  close();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.reader.state().unclosedResponses, 0);
});

test('missing closure, framing mismatch, hidden payload and foreign native links fail closed', async () => {
  for (const response of [
    (f) => f.wire(f.metadata, { closed: undefined }),
    (f) => f.wire(f.metadata, { headers: { 'content-length': '1' } }),
    (f) => f.wire(f.metadata, { headers: { 'content-encoding': 'gzip' } }),
    (f) => f.wire(f.metadata, { headers: { 'content-length': '1', 'transfer-encoding': 'chunked' } }),
  ]) {
    const f = nativeReaderFixture();
    f.answers.set('/api/v1/executions/101?includeData=false', () => response(f));
    await assert.rejects(f.reader.metadata(f.args), fixed);
  }
  for (const change of [
    (f) => {
      f.full.data.parentExecution = { executionId: '99', workflowId: 'foreign', shouldResume: true };
    },
    (f) => {
      f.full.data.resultData.runData['Known call'][0].metadata.subExecution.workflowId = 'foreign';
    },
    (f) => {
      f.full.data.resultData.runData['unknown node'] = [{}];
    },
    (f) => {
      f.full.data.resultData.runData['Known call'][0].data.main[0][0].json = {
        headers: { Authorization: secret },
      };
    },
  ]) {
    const f = nativeReaderFixture();
    change(f);
    await assert.rejects(f.reader.read(f.args), fixed);
  }
});

test('published binding requires matching current active graph plus identical execution snapshot', async () => {
  const f = nativeReaderFixture();
  f.binding.activeVersionId = f.binding.versionId;
  f.workflow.activeVersionId = f.binding.versionId;
  f.workflow.active = true;
  f.workflow.activeVersion = {
    workflowId: f.binding.workflowId,
    versionId: f.binding.versionId,
    nodes: structuredClone(f.workflow.nodes),
    connections: structuredClone(f.workflow.connections),
  };
  const r = await f.reader.read(f.args);
  assert.equal(r.bodyHash, f.binding.bodyHash);
  f.workflow.activeVersion.nodes[0].parameters.workflowId.value = 'changed';
  await assert.rejects(f.reader.read(f.args), fixed);
});

test('waiting with stoppedAt remains waiting; terminal waitTill and future timestamps are rejected', async () => {
  const f = nativeReaderFixture();
  f.metadata.status = 'waiting';
  f.metadata.waitTill = iso(30000);
  const r = await f.reader.metadata(f.args);
  assert.equal(r.status, 'waiting');
  assert.equal(r.stoppedAt, iso(-100));
  for (const change of [
    (x) => {
      x.metadata.waitTill = iso(10000);
    },
    (x) => {
      x.metadata.startedAt = iso(60000);
    },
    (x) => {
      x.metadata.stoppedAt = null;
    },
  ]) {
    const x = nativeReaderFixture();
    change(x);
    await assert.rejects(x.reader.metadata(x.args), fixed);
  }
});

test('executed calls without native child metadata stay explicit; only eligible native errors expect handler', async () => {
  const f = nativeReaderFixture();
  delete f.full.data.resultData.runData['Known call'][0].metadata;
  f.full.status = f.metadata.status = 'error';
  f.full.mode = f.metadata.mode = 'integrated';
  for (const body of [f.binding.body, f.workflow, f.full.workflowData])
    body.settings.errorWorkflow = f.bindings.workflowRefs['WF-90'].id;
  f.binding.bodyHash = runtimeGraphHash(f.binding.body);
  const r = await f.reader.read(f.args);
  assert.deepEqual(r.nativeChildren, []);
  assert.deepEqual(r.missingNativeChildCalls, [
    {
      key: 'WF-10',
      targetWorkflowId: f.bindings.workflowRefs['WF-10'].id,
      sourceNode: 'Known call',
      sourceRun: 0,
    },
  ]);
  assert.equal(r.errorDispatchExpected, true);
});

function traceReaderFixture(trace) {
  const f = nativeReaderFixture(),
    key = 'WF-19',
    id = f.bindings.workflowRefs[key].id;
  f.args.workflowKey = key;
  f.binding.workflowId = id;
  f.workflow.id = id;
  f.metadata.workflowId = id;
  f.full.workflowId = id;
  f.full.workflowData.id = id;
  f.metadata.mode = f.full.mode = 'webhook';
  f.binding.activeVersionId = f.binding.versionId;
  f.workflow.activeVersionId = f.binding.versionId;
  f.workflow.active = true;
  const hook = {
    id: 'hook',
    name: 'Native callback',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [0, 0],
    parameters: { path: 'fixed', httpMethod: 'POST' },
  };
  for (const body of [f.binding.body, f.workflow, f.full.workflowData]) {
    body.name = f.bindings.workflowRefs[key].name;
    body.nodes.push(structuredClone(hook));
  }
  f.workflow.activeVersion = {
    workflowId: id,
    versionId: f.binding.versionId,
    nodes: structuredClone(f.workflow.nodes),
    connections: {},
  };
  f.binding.bodyHash = runtimeGraphHash(f.binding.body);
  f.full.data.resultData.runData['Native callback'] = [
    { data: { main: [[{ json: { headers: { traceparent: trace }, body: {} } }]] } },
  ];
  f.answers.set('/api/v1/workflows/' + id + '?excludePinnedData=true', () => f.wire(f.workflow));
  return f;
}

test('WF19 trace correlation comes only from actual unpinned bound Webhook output', async () => {
  const trace = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
  const f = traceReaderFixture(trace);
  const r = await f.reader.read({ ...f.args, expectedTraceparent: trace });
  assert.equal(r.traceparent, trace);
  assert.equal(Object.hasOwn(r, 'headers'), false);
  for (const change of [
    (x) => {
      x.full.data.resultData.runData['Native callback'][0].data.main[0][0].json.headers.traceparent =
        '00-' + 'c'.repeat(32) + '-' + 'd'.repeat(16) + '-01';
    },
    (x) => {
      x.full.data.resultData.pinData = { 'Native callback': [] };
    },
    (x) => {
      x.workflow.pinData = { 'Native callback': [] };
    },
  ]) {
    const x = traceReaderFixture(trace);
    change(x);
    await assert.rejects(x.reader.read({ ...x.args, expectedTraceparent: trace }), fixed);
  }
  const bad = nativeReaderFixture();
  await assert.rejects(bad.reader.read({ ...bad.args, expectedTraceparent: trace }), fixed);
  assert.equal(bad.calls.length, 0);
});

test('WF19 exact concurrent pair returns only the actual native trace from the two-value allowlist', async () => {
  const a = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
  const b = '00-' + 'c'.repeat(32) + '-' + 'd'.repeat(16) + '-01';
  for (const actual of [a, b]) {
    const f = traceReaderFixture(actual);
    const r = await f.reader.read({ ...f.args, expectedTraceparents: [a, b] });
    assert.equal(r.traceparent, actual);
    assert.equal(Object.hasOwn(r, 'headers'), false);
    assert.equal(Object.hasOwn(r, 'expectedTraceparents'), false);
  }
});

test('concurrent trace matching refuses duplicate/expanded/mixed options, unrelated input and pinned native source', async () => {
  const a = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
  const b = '00-' + 'c'.repeat(32) + '-' + 'd'.repeat(16) + '-01';
  for (const expectedTraceparents of [[], [a], [a, a], [a, b, a], a, [a, b + '\n']]) {
    const f = traceReaderFixture(a);
    await assert.rejects(f.reader.read({ ...f.args, expectedTraceparents }), fixed);
    assert.equal(f.calls.length, 0);
  }
  for (const extra of [{ expectedTraceparent: a }, { expectedMode: 'integrated' }]) {
    const f = traceReaderFixture(a);
    await assert.rejects(f.reader.read({ ...f.args, expectedTraceparents: [a, b], ...extra }), fixed);
    assert.equal(f.calls.length, 0);
  }
  const wrongScope = nativeReaderFixture();
  await assert.rejects(wrongScope.reader.read({ ...wrongScope.args, expectedTraceparents: [a, b] }), fixed);
  assert.equal(wrongScope.calls.length, 0);
  const metadata = traceReaderFixture(a);
  await assert.rejects(metadata.reader.metadata({ ...metadata.args, expectedTraceparents: [a, b] }), fixed);
  assert.equal(metadata.calls.length, 0);
  const unrelated = '00-' + 'e'.repeat(32) + '-' + 'f'.repeat(16) + '-01';
  const mutable = traceReaderFixture(unrelated);
  const pair = [a, b];
  mutable.answers.set('/api/v1/executions/101?includeData=false', () => {
    pair.push(unrelated);
    return mutable.wire(mutable.metadata);
  });
  await assert.rejects(mutable.reader.read({ ...mutable.args, expectedTraceparents: pair }), fixed);
  assert.equal(pair.length, 3);
  for (const change of [
    (f) => {
      f.full.data.resultData.runData['Native callback'][0].data.main[0][0].json.headers.traceparent =
        '00-' + 'e'.repeat(32) + '-' + 'f'.repeat(16) + '-01';
    },
    (f) => {
      f.full.data.resultData.pinData = { 'Native callback': [] };
    },
    (f) => {
      f.workflow.pinData = { 'Native callback': [] };
    },
  ]) {
    const f = traceReaderFixture(a);
    change(f);
    await assert.rejects(f.reader.read({ ...f.args, expectedTraceparents: [a, b] }), fixed);
  }
});

test('Webhook response reduction proves only HTTP acknowledgement and never returns body/headers', async () => {
  const f = nativeReaderFixture(),
    signal = new AbortController().signal;
  const r = await f.reader.webhookResponse({ response: f.wire({ message: 'Workflow was started' }), signal });
  assert.deepEqual(r, {
    kind: 'foundation_native_webhook_ack',
    httpStatus: 200,
    transportClosed: true,
    privacyChecked: true,
  });
  await assert.rejects(f.reader.webhookResponse({ response: f.wire({ message: secret }), signal }), fixed);
});

test('private scanner refuses native redaction that could conceal retained reflection', async () => {
  const f = nativeReaderFixture();
  f.full.data.redactionInfo = { isRedacted: true, reason: 'synthetic', canReveal: false };
  await assert.rejects(f.reader.read(f.args), fixed);
});

test('only actual prepared gateway request IDs matching approvedCode/nativeexecution are projected', async () => {
  const f = nativeReaderFixture();
  const stored = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const transport = { audience: stored.audience, windowId: stored.windowId, credential: stored.credential };
  const graph = gatewayOperationNodes('WF-00', 'Known operation', transport, 'health.read', '({})', [
    'h',
    'cairo_yesterday',
  ]);
  for (const body of [f.binding.body, f.workflow, f.full.workflowData])
    body.nodes.push(...structuredClone(graph.nodes));
  f.binding.bodyHash = runtimeGraphHash(f.binding.body);
  const h = createHash('sha256')
    .update('emr-m03-foundation:WF-00:Known operation:101:business')
    .digest('hex');
  const requestId =
    h.slice(0, 8) +
    '-' +
    h.slice(8, 12) +
    '-4' +
    h.slice(13, 16) +
    '-a' +
    h.slice(17, 20) +
    '-' +
    h.slice(20, 32);
  f.full.data.resultData.runData['Prepare gateway · Known operation'] = [
    {
      data: {
        main: [[{ json: { request: { version: 1, requestId, operation: 'health.read', args: {} } } }]],
      },
    },
  ];
  // Deliberately no native Invoke node run: prepared-but-undispatched work stays visible.
  const r = await f.reader.read(f.args);
  assert.deepEqual(r.nativeGatewayRequests, [{ requestId, operation: 'health.read' }]);
  f.full.data.resultData.runData[
    'Prepare gateway · Known operation'
  ][0].data.main[0][0].json.request.requestId = '00000000-0000-4000-a000-000000000000';
  await assert.rejects(f.reader.read(f.args), fixed);
});

test('stop response is a closed acknowledgement only and never a native completion receipt', async () => {
  const f = nativeReaderFixture();
  const receipt = await f.reader.metadata(f.args);
  const signal = new AbortController().signal;
  const result = await f.reader.stopResponse({
    response: f.wire({
      mode: 'manual',
      status: 'canceled',
      startedAt: f.metadata.startedAt,
      stoppedAt: f.metadata.stoppedAt,
      finished: false,
    }),
    receipt,
    signal,
  });
  assert.equal(result.cancellationAcknowledged, true);
  assert.equal(result.completionProven, false);
  assert.equal(result.executionId, '101');
  assert.throws(() => assertFoundationNativeReceipt(result), fixed);
  const conflict = await f.reader.stopResponse({
    response: f.wire({ message: 'not stoppable' }, { status: 409 }),
    receipt,
    signal,
  });
  assert.equal(conflict.cancellationAcknowledged, false);
  assert.equal(conflict.httpStatus, 409);
  await assert.rejects(
    f.reader.stopResponse({ response: f.wire({ message: secret }, { status: 409 }), receipt, signal }),
    fixed,
  );
});

test('binding preflight is exactly one private GET and exposes no graph', async () => {
  const f = nativeReaderFixture();
  const r = await f.reader.verifyBinding({ workflowKey: f.workflowKey, binding: f.binding });
  assert.equal(f.calls.length, 1);
  assert.equal(r.bodyHash, f.binding.bodyHash);
  assert.equal(Object.hasOwn(r, 'body'), false);
  f.workflow.versionId = 'edited';
  await assert.rejects(f.reader.verifyBinding({ workflowKey: f.workflowKey, binding: f.binding }), fixed);
});

test('intentional500 Webhook response is private HTTP evidence only', async () => {
  const f = nativeReaderFixture(),
    signal = new AbortController().signal;
  const r = await f.reader.webhookResponse({
    response: f.wire({ message: 'synthetic expected error' }, { status: 500 }),
    signal,
  });
  assert.equal(r.httpStatus, 500);
  assert.equal(Object.hasOwn(r, 'message'), false);
  await assert.rejects(
    f.reader.webhookResponse({ response: f.wire({ message: secret }, { status: 500 }), signal }),
    fixed,
  );
});

test('unknown callback403 requires its explicit expected status; other denial statuses never become an acknowledgement', async () => {
  const f = nativeReaderFixture();
  const signal = new AbortController().signal;
  const ack = await f.reader.webhookResponse({
    response: f.wire({ accepted: false }, { status: 403 }),
    expectedHttpStatus: 403,
    signal,
  });
  assert.equal(ack.httpStatus, 403);
  assert.equal(ack.transportClosed, true);
  assert.equal(Object.hasOwn(ack, 'accepted'), false);
  for (const [status, expectedHttpStatus] of [
    [403, undefined],
    [401, 403],
    [404, 403],
    [200, 403],
    [500, 200],
    [403, 401],
  ]) {
    await assert.rejects(
      f.reader.webhookResponse({
        response: f.wire({}, { status }),
        signal,
        ...(expectedHttpStatus === undefined ? {} : { expectedHttpStatus }),
      }),
      fixed,
    );
  }
});

test('callback projection binds native validated source to unpinned original Webhook; missing/forged stay unproven', async () => {
  function callbackFixture() {
    const f = nativeReaderFixture(),
      id = f.bindings.workflowRefs['WF-19'].id;
    f.args.workflowKey = 'WF-19';
    f.binding.workflowId = id;
    f.workflow.id = id;
    f.metadata.workflowId = id;
    f.full.workflowId = id;
    f.full.workflowData.id = id;
    f.metadata.mode = f.full.mode = 'webhook';
    f.binding.activeVersionId = f.binding.versionId;
    f.workflow.activeVersionId = f.binding.versionId;
    f.workflow.active = true;
    const nodes = [
      {
        id: 'hook',
        name: 'Apify callback',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: { path: 'fixed' },
      },
      {
        id: 'validator',
        name: 'Validate callback source',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1, 0],
        parameters: { jsCode: 'return items;' },
      },
    ];
    for (const body of [f.binding.body, f.workflow, f.full.workflowData]) {
      body.name = f.bindings.workflowRefs['WF-19'].name;
      body.nodes.push(...structuredClone(nodes));
    }
    f.workflow.activeVersion = {
      workflowId: id,
      versionId: f.binding.versionId,
      nodes: structuredClone(f.workflow.nodes),
      connections: {},
    };
    f.binding.bodyHash = runtimeGraphHash(f.binding.body);
    f.full.data.resultData.runData['Apify callback'] = [
      {
        data: {
          main: [
            [
              {
                json: {
                  headers: {},
                  body: { eventType: 'ACTOR.RUN.SUCCEEDED', resource: { id: 'syntheticOriginalRun' } },
                },
              },
            ],
          ],
        },
      },
    ];
    f.full.data.resultData.runData['Validate callback source'] = [
      {
        data: {
          main: [
            [
              {
                json: {
                  apify_run_id: 'syntheticOriginalRun',
                  transport: 'webhook',
                  params: ['syntheticOriginalRun'],
                },
              },
            ],
          ],
        },
      },
    ];
    f.answers.set('/api/v1/workflows/' + id + '?excludePinnedData=true', () => f.wire(f.workflow));
    return f;
  }
  const f = callbackFixture(),
    r = await f.reader.read(f.args);
  assert.deepEqual(r.nativeProviderCallback, {
    apifyRunId: 'syntheticOriginalRun',
    eventType: 'ACTOR.RUN.SUCCEEDED',
  });
  assert.equal(Object.hasOwn(r, 'providerAuthenticated'), false);
  const missing = callbackFixture();
  delete missing.full.data.resultData.runData['Validate callback source'];
  assert.equal((await missing.reader.read(missing.args)).nativeProviderCallback, null);
  for (const change of [
    (x) => {
      x.full.data.resultData.runData['Apify callback'][0].data.main[0][0].json.body.resource.id =
        'forgedDifferentRun';
    },
    (x) => {
      x.full.data.resultData.runData['Validate callback source'][0].data.main[0][0].json.transport =
        'recovery';
    },
    (x) => {
      x.full.data.resultData.pinData = { 'Apify callback': [] };
    },
  ]) {
    const x = callbackFixture();
    change(x);
    await assert.rejects(x.reader.read(x.args), fixed);
  }
});
