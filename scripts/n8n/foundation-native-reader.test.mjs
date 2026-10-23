import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { gatewayOperationNodes } from '../../n8n/foundation/build-foundation-gateway.mjs';
import {
  createFoundationNativeReader,
  assertFoundationNativeReader,
  assertFoundationNativeMetadataReceipt,
  assertFoundationNativeReceipt,
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
