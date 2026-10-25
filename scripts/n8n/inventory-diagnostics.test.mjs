import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { inventoryDiagnosticVersion, runInventory } from './inventory.mjs';
import * as inventory from './inventory.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const key = 'synthetic-diagnostic-key-only';
async function execution31145Fixture() {
  const { buildFoundationNativeDomainProbe, foundationNativeDomainProbe } =
    await import('./foundation-live-domain-probe.mjs');
  const { runtimeGraphHash } = await import('./foundation-runtime-control.mjs');
  const runtimeAudience = 'https://everyone-market-researcher-synthetic-pin-diagnostic.vercel.app';
  const body = buildFoundationNativeDomainProbe({
    runtimeAudience,
    settings: {
      availableInMCP: true,
      saveManualExecutions: true,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveExecutionProgress: false,
    },
  }).workflow;
  const message = `Domain not allowed: This credential is restricted from accessing ${new URL(foundationNativeDomainProbe.targetAudience).host}. Only the following domains are allowed: ${new URL(runtimeAudience).host}`;
  const error = {
    name: 'NodeApiError',
    message,
    httpCode: null,
    node: structuredClone(body.nodes[1]),
    context: { request: { method: 'POST', uri: body.nodes[1].parameters.url } },
  };
  const context = {
    versionId: 'Synthetic31145Version',
    bodyHash: runtimeGraphHash(body),
    runtimeAudience,
    intentAt: Date.parse('2026-10-25T13:57:37.181Z'),
  };
  const dto = {
    id: '31145',
    workflowId: 'qTjioYmBUVMIERVz',
    workflowVersionId: context.versionId,
    mode: 'manual',
    status: 'error',
    workflowData: { id: 'qTjioYmBUVMIERVz', versionId: context.versionId, ...body },
    data: {
      resultData: {
        pinData: { [body.nodes[0].name]: [{ json: {} }] },
        error,
        runData: {
          [body.nodes[0].name]: [{ data: { main: [[{ json: {} }]] } }],
          [body.nodes[1].name]: [{ error: structuredClone(error) }],
        },
      },
    },
  };
  return { dto, context, manualName: body.nodes[0].name };
}
test('execution31145 pin classifier distinguishes finite native shapes without releasing received keys or values', async () => {
  const f = await execution31145Fixture();
  const r = await inventory.projectExecution31145Pins(f.dto, f.context);
  assert.equal(r.fields.pinsPassExistingReader, true);
  assert.equal(r.fields.executedGraphMatches, true);
  assert.equal(r.fields.domainDenialShapeMatches, true);
  assert.equal(r.counts.pinNodeCount, 1);
  assert.equal(r.counts.pinJsonKeyCount, 0);
  for (const mode of ['null', 'array', 'paired', 'business', 'extra', 'unknown']) {
    const x = await execution31145Fixture(),
      p = x.dto.data.resultData;
    if (mode === 'null') p.pinData = null;
    if (mode === 'array') p.pinData = [];
    if (mode === 'paired') p.pinData[x.manualName][0].pairedItem = { item: 0 };
    if (mode === 'business')
      p.pinData[x.manualName][0].json.SYNTHETIC_PRIVATE_KEY = 'SYNTHETIC_PRIVATE_VALUE';
    if (mode === 'extra') p.pinData[x.manualName][0].SYNTHETIC_PRIVATE_EXTRA = 'SYNTHETIC_PRIVATE_VALUE';
    if (mode === 'unknown')
      p.pinData.SYNTHETIC_PRIVATE_NODE = [{ json: { private: 'SYNTHETIC_PRIVATE_VALUE' } }];
    const got = await inventory.projectExecution31145Pins(x.dto, x.context);
    assert.equal(got.fields.pinsPassExistingReader, false, mode);
    assert.doesNotMatch(
      JSON.stringify(got),
      /SYNTHETIC_PRIVATE|Synthetic31145|Manual Machine|https:|NodeApiError|workflowData|pinData/,
    );
  }
});
test('execution31145 diagnostic makes exactly one fixed native GET and remains forensic on malformed pins', async () => {
  const x = await execution31145Fixture();
  x.dto.data.resultData.pinData = null;
  const f = native31130Fixture(x.dto);
  let charges = 0,
    closed = 0;
  const r = await inventory.runExecution31145PinDiagnostic(key, {
    ...f.options,
    readContext: () => x.context,
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed++;
      },
    }),
  });
  assert.equal(r.status, 'native_snapshot_classified');
  assert.equal(r.technicalAttempt, 22);
  assert.equal(r.acceptanceProven, false);
  assert.equal(charges, 1);
  assert.equal(closed, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/api/v1/executions/31145?includeData=true');
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.forensics.fields.pinsNull, true);
  assert.equal(r.forensics.fields.pinsPassExistingReader, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /Synthetic31145|https:|NodeApiError|workflowData|SYNTHETIC_PRIVATE|synthetic-diagnostic-key/,
  );
});
test('execution31145 diagnostics preserve one-call failure and closure boundaries without leaking payloads', async () => {
  for (const mode of ['json', 'http', 'framing', 'dns', 'unclosed']) {
    const x = await execution31145Fixture(),
      f = native31130Fixture(x.dto, {
        rawBody: mode === 'json' ? '{' : null,
        status: mode === 'http' ? 503 : 200,
        framing: mode === 'framing',
        unclosed: mode === 'unclosed',
      });
    if (mode === 'dns')
      f.options.nativeTransport.resolveInstance = async () => {
        throw Error('SYNTHETIC_PRIVATE');
      };
    let charged = 0,
      closed = 0;
    const r = await inventory.runExecution31145PinDiagnostic(key, {
      ...f.options,
      timeoutMs: 50,
      closeTimeoutMs: 10,
      readContext: () => x.context,
      openBudget: () => ({
        admit() {
          charged++;
        },
        close() {
          closed++;
        },
      }),
    });
    assert.equal(r.status, 'native_snapshot_failed', mode);
    assert.equal(charged, 1, mode);
    assert.equal(closed, 1, mode);
    assert.equal(r.requestCount, 1, mode);
    assert.equal(f.calls.length, mode === 'dns' ? 0 : 1, mode);
    assert.equal(r.acceptanceProven, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|Synthetic31145|https:|NodeApiError|workflowData|synthetic-diagnostic-key/,
    );
  }
  const x = await execution31145Fixture();
  x.dto.data.resultData.pinData = Object.fromEntries(
    Array.from({ length: 201 }, (_, i) => ['SYNTHETIC_PRIVATE_' + i, []]),
  );
  const bounded = await inventory.projectExecution31145Pins(x.dto, x.context);
  assert.equal(bounded.counts.pinNodeCount, null);
  assert.equal(bounded.fields.pinsPassExistingReader, false);
  assert.doesNotMatch(JSON.stringify(bounded), /SYNTHETIC_PRIVATE/);
});
test('wf32 single-page classifier emits only fixed booleans and never payloads or candidate identities', () => {
  const r = inventory.projectWf32DiscoveryDiagnostic({
    data: [
      { id: '123', workflowId: 'kkAGgnbD8NjWHMKC', status: 'running', data: { secret: 'SYNTHETIC_PRIVATE' } },
    ],
    nextCursor: null,
  });
  assert.equal(r.pendingCountZero, false);
  assert.equal(r.payloadAbsent, false);
  assert.equal(r.unknownStatusCountZero, true);
  assert.equal(r.listShapeVerified, false);
  assert.equal(
    Object.values(r).every((v) => typeof v === 'boolean'),
    true,
  );
  assert.doesNotMatch(JSON.stringify(r), /123|SYNTHETIC_PRIVATE|secret/);
});
test('wf32 native single GET preserves fixed transport parse and confidentiality failures and closes every child response', async () => {
  for (const mode of ['success', 'dns', 'json', 'privacy', 'shape', 'http']) {
    const f = native31130Fixture(
      mode === 'privacy'
        ? { data: [], nextCursor: null, private: key }
        : mode === 'shape'
          ? { data: null, nextCursor: null }
          : { data: [], nextCursor: null },
      { rawBody: mode === 'json' ? '{' : null, status: mode === 'http' ? 503 : 200 },
    );
    if (mode === 'dns')
      f.options.nativeTransport.resolveInstance = async () => {
        throw Error('SYNTHETIC_PRIVATE');
      };
    let charged = 0,
      closed = 0;
    const r = await inventory.runWf32DiscoveryDiagnostic(key, {
      ...f.options,
      openBudget: () => ({
        admit() {
          charged++;
        },
        close() {
          closed++;
        },
      }),
    });
    assert.equal(charged, 1);
    assert.equal(closed, 1);
    assert.equal(r.requestCount, 1);
    assert.equal(r.networkCompletionVerified, true);
    assert.equal(r.acceptanceProven, false);
    assert.equal(r.drainProven, false);
    assert.equal(f.calls.length, mode === 'dns' ? 0 : 1);
    if (f.calls.length)
      assert.equal(
        f.calls[0].path,
        '/api/v1/executions?workflowId=kkAGgnbD8NjWHMKC&includeData=false&limit=120',
      );
    if (mode === 'dns') assert.equal(r.nativeTransportCode, 'DNS');
    if (mode === 'json') assert.equal(r.readerCode, 'JSON');
    if (mode === 'privacy') assert.equal(r.readerCode, 'SENSITIVE_REFLECTION');
    if (mode === 'shape') assert.equal(r.fields.listShapeVerified, false);
    if (mode === 'http') assert.equal(r.httpStatus, 503);
    assert.doesNotMatch(
      JSON.stringify(r),
      /synthetic-diagnostic-key|SYNTHETIC_PRIVATE|"nextCursor":|\/api\/|stack|headers/,
    );
  }
});
test('wf32 actual CLI ENTRY defers the genuine native import cycle and performs one synthetic streaming GET only', () => {
  for (const mode of ['success', 'dns', 'json', 'privacy']) {
    const root = mkdtempSync(join(tmpdir(), 'emr-wf32-entry-'));
    try {
      const put = (p, t) => {
        const f = join(root, p);
        mkdirSync(resolve(f, '..'), { recursive: true });
        writeFileSync(f, t);
        return f;
      };
      const claim = put('scripts/n8n/out/foundation/claim.jsonl', '');
      let source = readFileSync('scripts/n8n/inventory.mjs', 'utf8').replace(
        'export async function openWf32DiscoveryDiagnosticBudget(root)',
        'async function originalOpenWf32DiscoveryDiagnosticBudget(root)',
      );
      source += `\nexport async function openWf32DiscoveryDiagnosticBudget(){let done=false;return {admit(){if(done)throw Error('TEST_DOUBLE_ADMISSION');done=true;const fd=openSync(${JSON.stringify(claim)},'a');try{for(const r of [{kind:'synthetic_independent_public_proof'},{event:'management_attempt',ordinal:863},{event:'native_read_control_reservation',ordinal:994,additionalHttpRequest:false}])writeSync(fd,JSON.stringify(r)+'\\n');fsyncSync(fd);}finally{closeSync(fd);}},close(){}};}\n`;
      const entry = put('scripts/n8n/inventory.mjs', source);
      put('n8n/foundation/bindings.dev.json', readFileSync('n8n/foundation/bindings.dev.json'));
      const dns = put(
        'dns.mjs',
        `export function lookup(_h,_o,cb){${mode === 'dns' ? "cb(Error('SYNTHETIC_PRIVATE'))" : "cb(null,[{address:'1.1.1.1',family:4}])"};}`,
      );
      const body =
        mode === 'json'
          ? '{'
          : JSON.stringify(
              mode === 'privacy' ? { data: [], nextCursor: null, note: key } : { data: [], nextCursor: null },
            );
      const http = put(
        'https.mjs',
        `import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';export function request(o,cb){if(o.method!=='GET'||o.path!=='/api/v1/executions?workflowId=kkAGgnbD8NjWHMKC&includeData=false&limit=120')throw Error('TEST_ROUTE');const req=new EventEmitter(),socket=new EventEmitter();socket.encrypted=true;socket.authorized=true;socket.remoteAddress='1.1.1.1';let res,closed=false;const close=()=>{if(closed)return;closed=true;res?.destroy();req.emit('close');socket.emit('close');};req.destroy=close;socket.destroy=close;req.end=()=>queueMicrotask(()=>{req.emit('socket',socket);socket.emit('secureConnect');res=new PassThrough();res.complete=true;res.statusCode=200;res.headers={'content-type':'application/json'};cb(res);res.once('end',close);if(!res.destroyed)res.end(Buffer.from(${JSON.stringify(body)}));});return req;}`,
      );
      const copy = pathToFileURL(entry).href,
        transport = pathToFileURL(resolve('scripts/n8n/foundation-native-transport.mjs')).href,
        reader = pathToFileURL(resolve('scripts/n8n/foundation-native-reader.mjs')).href;
      const preload = put(
        'preload.mjs',
        `import {registerHooks} from 'node:module';registerHooks({resolve(s,c,next){if(c.parentURL===${JSON.stringify(copy)}&&s==='./foundation-native-transport.mjs')return {url:${JSON.stringify(transport)},shortCircuit:true};if(c.parentURL===${JSON.stringify(copy)}&&s==='./foundation-native-reader.mjs')return {url:${JSON.stringify(reader)},shortCircuit:true};if(s==='./inventory.mjs'&&c.parentURL?.includes('/scripts/n8n/'))return {url:${JSON.stringify(copy)},shortCircuit:true};if(c.parentURL===${JSON.stringify(copy)}&&s==='node:dns')return {url:${JSON.stringify(pathToFileURL(dns).href)},shortCircuit:true};if(c.parentURL===${JSON.stringify(transport)}&&s==='node:https')return {url:${JSON.stringify(pathToFileURL(http).href)},shortCircuit:true};return next(s,c);}});`,
      );
      const env = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((k) =>
          process.env[k] === undefined ? [] : [[k, process.env[k]]],
        ),
      );
      const r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(preload).href, entry, '--wf32-discovery-diagnostic'],
        { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', timeout: 10000, windowsHide: true },
      );
      assert.equal(r.status, mode === 'success' ? 0 : 1);
      assert.equal(r.stderr, '');
      const dto = JSON.parse(r.stdout);
      assert.equal(dto.requestCount, 1);
      assert.equal(dto.networkCompletionVerified, true);
      assert.equal(dto.acceptanceProven, false);
      assert.equal(dto.drainProven, false);
      if (mode === 'success') assert.equal(dto.fields.firstPageEmpty, true);
      if (mode === 'dns') assert.equal(dto.nativeTransportCode, 'DNS');
      if (mode === 'json') assert.equal(dto.readerCode, 'JSON');
      if (mode === 'privacy') assert.equal(dto.readerCode, 'SENSITIVE_REFLECTION');
      assert.equal(readFileSync(claim, 'utf8').trim().split('\n').length, 3);
      assert.doesNotMatch(r.stdout, /synthetic-diagnostic-key|SYNTHETIC_PRIVATE|stack|headers/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
test('wf32 portable public custody and one-use863/994 debit refuse historical drift and preserve all originals', async () => {
  const f = await syntheticExecution31130PublicChain({ throughCategory: true }),
    root = f.root;
  try {
    const digest = (b) => createHash('sha256').update(b).digest('hex');
    const put = (p, v) => {
      const b = typeof v === 'string' ? v : JSON.stringify(v);
      mkdirSync(resolve(join(root, p), '..'), { recursive: true });
      writeFileSync(join(root, p), b);
      return digest(b);
    };
    const claim = 'scripts/n8n/out/foundation/execution-31130-parameter-defaults-diagnostic-20261024.jsonl';
    const resolution = JSON.parse(
      readFileSync(
        'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json',
        'utf8',
      ),
    );
    resolution.pins[claim] = put(claim, JSON.stringify({ kind: 'synthetic_spent829' }) + '\n');
    let source = readFileSync(join(root, 'scripts/n8n/inventory.mjs'), 'utf8').replaceAll(
      'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b',
      put(
        'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json',
        resolution,
      ),
    );
    for (let i = 1; i <= 4; i++) {
      const p =
          'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt' + i + '-20261024.json',
        r = JSON.parse(readFileSync(p, 'utf8'));
      const old = digest(readFileSync(p));
      r.pins = {};
      for (const suffix of ['.json', '.jsonl', '.provision-seal.json', '.runtime-lock']) {
        const path = 'scripts/n8n/out/foundation/synthetic-spent' + i + suffix;
        r.pins[path] = put(path, 'synthetic-public-spent' + i + suffix + '\n');
      }
      r.cleanup.parentProcessId = 2147483647;
      r.cleanup.childProcessId = 2147483646;
      source = source.replaceAll(old, put(p, r));
    }
    const entry = join(root, 'scripts/n8n/inventory-wf32.mjs');
    writeFileSync(entry, source);
    const m = await import(pathToFileURL(entry).href);
    assert.equal((await m.checkWf32DiscoveryDiagnostic(root)).managementAttempts, 862);
    const oldPath = 'scripts/n8n/out/foundation/synthetic-spent3.jsonl',
      before = readFileSync(join(root, oldPath));
    const budget = await m.openWf32DiscoveryDiagnosticBudget(root);
    writeFileSync(join(root, oldPath), Buffer.concat([before, Buffer.from(' ')]));
    assert.throws(() => budget.admit());
    writeFileSync(join(root, oldPath), before);
    budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    await assert.rejects(m.openWf32DiscoveryDiagnosticBudget(root));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(rows.slice(1), [
      { event: 'management_attempt', ordinal: 863 },
      { event: 'native_read_control_reservation', ordinal: 994, additionalHttpRequest: false },
    ]);
    for (const [p, b] of f.originals) assert.deepEqual(readFileSync(join(root, p)), b);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
async function category31130Fixture() {
  const f = await snapshot31130Fixture();
  f.dto.workflowData.nodes.forEach((n, i) => {
    n.id = 'SyntheticNode' + i;
  });
  f.context.expectedBody = structuredClone(f.dto.workflowData);
  delete f.context.expectedBody.settings.binaryMode;
  const { foundationRuntimeGraphHash } = await import('./foundation-runtime-checkpoint.mjs');
  f.context.bodyHash = foundationRuntimeGraphHash(f.context.expectedBody);
  return f;
}
async function parameterDefaults31130Fixture() {
  const f = await category31130Fixture();
  f.context.expectedBody.nodes[1].typeVersion = 1.4;
  f.context.expectedBody.nodes.push({
    id: 'KnownSourceSet',
    name: 'Known source Set',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.5,
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [] }, options: {} },
    position: [200, 0],
  });
  const { foundationRuntimeGraphHash, foundationRuntimeExecutionParameterCandidates } =
    await import('./foundation-runtime-checkpoint.mjs');
  f.context.bodyHash = foundationRuntimeGraphHash(f.context.expectedBody);
  const c = foundationRuntimeExecutionParameterCandidates(f.context.expectedBody);
  f.dto.workflowData = {
    ...structuredClone(c.nativeDefaults),
    id: 'MzimjpsuyPuK7SKe',
    settings: { ...c.nativeDefaults.settings, binaryMode: 'separate' },
  };
  return { ...f, candidates: c };
}
test('parameter defaults31130 projector requires an exact expected expansion and actual known Set run before its second candidate', async () => {
  const f = await parameterDefaults31130Fixture();
  let r = await inventory.projectExecution31130ParameterDefaults(f.dto, f.context);
  assert.equal(r.fields.nativeDefaultsMatch, true);
  assert.equal(r.fields.graphQualified, true);
  assert.equal(r.fields.knownSetExecuted, false);
  f.dto.workflowData.nodes = structuredClone(f.candidates.nativeDefaultsAndSetOutput.nodes);
  r = await inventory.projectExecution31130ParameterDefaults(f.dto, f.context);
  assert.equal(r.fields.graphQualified, false);
  assert.equal(r.fields.nativeDefaultsAndSetOutputMatch, false);
  f.dto.data.resultData.runData['Unknown response-defined Set'] = [
    { data: { private: 'SYNTHETIC_PRIVATE' } },
  ];
  assert.equal(
    (await inventory.projectExecution31130ParameterDefaults(f.dto, f.context)).fields.graphQualified,
    false,
  );
  f.dto.data.resultData.runData['Known source Set'] = [{ data: { private: 'SYNTHETIC_PRIVATE' } }];
  r = await inventory.projectExecution31130ParameterDefaults(f.dto, f.context);
  assert.equal(r.fields.knownSetExecuted, true);
  assert.equal(r.fields.nativeDefaultsAndSetOutputMatch, true);
  assert.equal(r.fields.graphQualified, true);
  f.dto.workflowData.nodes[0].parameters.notice = 'SYNTHETIC_PRIVATE';
  r = await inventory.projectExecution31130ParameterDefaults(f.dto, f.context);
  assert.equal(r.fields.graphQualified, false);
  assert.equal(r.nodeTypes.manualTrigger.parametersMatch, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Known source Set|Unknown response|SyntheticNode|bodyHash|versionId/,
  );
  await assert.rejects(
    inventory.projectExecution31130ParameterDefaults(f.dto, { ...f.context, bodyHash: 'a'.repeat(64) }),
  );
});
test('category31130 projector privately distinguishes fixed fields and node order without exposing response-defined keys', async () => {
  const f = await category31130Fixture();
  f.dto.workflowData.nodes.reverse();
  f.dto.workflowData.settings.errorWorkflow = 'DEFAULT';
  const r = await inventory.projectExecution31130Categories(f.dto, f.context);
  assert.equal(r.nodes.idSetEqual, true);
  assert.equal(r.nodes.idOrderEqual, false);
  assert.equal(r.nodes.idAlignedExact, true);
  assert.equal(r.components.nodesEqual, false);
  assert.equal(r.nodeFields.parameters, true);
  assert.equal(r.settings.errorWorkflow.expectedPresent, false);
  assert.equal(r.settings.errorWorkflow.observedPresent, true);
  assert.equal(r.normalizationCandidates.settingsEqualAfterDefaultErrorWorkflowOmitted, true);
  f.dto.workflowData.nodes[0].parameters = { secret: 'SYNTHETIC_PRIVATE_VALUE' };
  f.dto.workflowData.settings.SYNTHETIC_PRIVATE_SETTING = 'SYNTHETIC_PRIVATE_VALUE';
  const changed = await inventory.projectExecution31130Categories(f.dto, f.context);
  assert.equal(changed.nodeFields.parameters, false);
  assert.equal(changed.settingsUnknownKeyPresent, true);
  assert.equal(changed.normalizationCandidates.graphEqualAfterNodeOrderAlignment, false);
  assert.doesNotMatch(
    JSON.stringify(changed),
    /SYNTHETIC_PRIVATE|SyntheticNode|Call Vimeo|Synthetic owned graph/,
  );
});
test('category31130 projector rejects an unverified reconstructed body and reports only false predicates for malformed snapshots', async () => {
  const f = await category31130Fixture();
  await assert.rejects(
    inventory.projectExecution31130Categories(f.dto, { ...f.context, bodyHash: 'a'.repeat(64) }),
  );
  const r = await inventory.projectExecution31130Categories({ workflowData: [] }, f.context);
  assert.equal(r.components.nodesEqual, false);
  assert.equal(r.nodes.idAlignedExact, false);
  assert.equal(
    Object.values(r.nodeFields).every((v) => v === false),
    true,
  );
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|SyntheticNode/);
});
async function snapshot31130Fixture() {
  const snapshot = {
    id: 'MzimjpsuyPuK7SKe',
    versionId: 'Synthetic31130Version',
    name: 'Synthetic owned graph',
    settings: { binaryMode: 'separate', availableInMCP: true },
    connections: {},
    nodes: [
      {
        name: 'Manual',
        type: 'n8n-nodes-base.manualTrigger',
        parameters: {},
        position: [0, 0],
        typeVersion: 1,
      },
      {
        name: 'Call Vimeo',
        type: 'n8n-nodes-base.executeWorkflow',
        parameters: { workflowId: '4JMHLDBSdgGxhPlk' },
        position: [100, 0],
        typeVersion: 1,
      },
    ],
  };
  const { foundationRuntimeObservedGraphHash } = await import('./foundation-runtime-checkpoint.mjs');
  return {
    dto: {
      ...execution31130Dto(),
      workflowData: snapshot,
      data: {
        resultData: {
          runData: {
            Manual: [{ data: { main: [[{ json: {} }]] } }],
            'Call Vimeo': [
              {
                metadata: { subExecution: { executionId: '31131', workflowId: '4JMHLDBSdgGxhPlk' } },
                data: { main: [[{ json: { private: 'SYNTHETIC_PRIVATE' } }]] },
              },
            ],
          },
        },
      },
    },
    context: {
      versionId: 'Synthetic31130Version',
      intentAt: 0,
      bodyHash: foundationRuntimeObservedGraphHash(snapshot, {
        key: 'WF-00',
        id: snapshot.id,
        nativeReadonlySettings: { binaryMode: 'separate' },
      }),
    },
  };
}
test('snapshot31130 projector checks the past graph and known child privately without emitting native receipts or payload', async () => {
  const f = await snapshot31130Fixture(),
    r = await inventory.projectExecution31130Snapshot(f.dto, f.context);
  assert.equal(r.fields.executedGraphMatches, true);
  assert.equal(r.fields.runDataNamesKnown, true);
  assert.equal(r.fields.observedChildLink, true);
  assert.deepEqual(r.childExecutionIds, ['31131']);
  assert.equal(r.nativeTreeSettlementProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|Synthetic owned graph|Call Vimeo|settings|bodyHash|workflowData|"resultData"/,
  );
});
test('snapshot31130 projector distinguishes redaction, pins, graph, names and child mismatches without disclosing values', async () => {
  for (const mode of ['graph', 'version', 'name', 'redacted', 'pin', 'child', 'parent']) {
    const f = await snapshot31130Fixture();
    if (mode === 'graph') f.dto.workflowData.name = 'SYNTHETIC_PRIVATE';
    if (mode === 'version') f.dto.workflowVersionId = 'SYNTHETIC_PRIVATE';
    if (mode === 'name') f.dto.data.resultData.runData.SYNTHETIC_PRIVATE = [];
    if (mode === 'redacted')
      f.dto.data.redactionInfo = { isRedacted: true, provisional: true, secret: 'SYNTHETIC_PRIVATE' };
    if (mode === 'pin')
      f.dto.data.resultData.pinData = { Manual: [{ json: { private: 'SYNTHETIC_PRIVATE' } }] };
    if (mode === 'child')
      f.dto.data.resultData.runData['Call Vimeo'][0].metadata.subExecution = {
        executionId: '99111',
        workflowId: 'SYNTHETIC_PRIVATE',
      };
    if (mode === 'parent')
      f.dto.data.parentExecution = { executionId: '99112', workflowId: 'SYNTHETIC_PRIVATE' };
    const r = await inventory.projectExecution31130Snapshot(f.dto, f.context);
    const key = {
      graph: 'executedGraphMatches',
      version: 'versionMatchesIntent',
      name: 'runDataNamesKnown',
      redacted: 'redactionPassesExistingReader',
      pin: 'pinsPassExistingReader',
      child: 'childLinksShape',
      parent: 'rootParentAbsent',
    }[mode];
    assert.equal(r.fields[key], false, mode);
    assert.equal(r.nativeTreeSettlementProven, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|99111|99112|Synthetic31130Version|Call Vimeo|bodyHash/,
    );
  }
});
test('snapshot31130 pin classification mirrors the existing sole-enabled-trigger rule without widening it', async () => {
  const f = await snapshot31130Fixture();
  f.dto.data.resultData.pinData = { Manual: [{ json: {} }] };
  assert.equal(
    (await inventory.projectExecution31130Snapshot(f.dto, f.context)).fields.pinsPassExistingReader,
    true,
  );
  f.dto.workflowData.nodes.push({
    name: 'Schedule',
    type: 'n8n-nodes-base.scheduleTrigger',
    parameters: {},
    position: [0, 100],
    typeVersion: 1,
  });
  assert.equal(
    (await inventory.projectExecution31130Snapshot(f.dto, f.context)).fields.pinsPassExistingReader,
    false,
  );
});
function native31130Fixture(dto, { unclosed = false, framing = false, status = 200, rawBody = null } = {}) {
  const calls = [];
  return {
    calls,
    options: {
      readContext: () => ({
        versionId: 'Synthetic31130Version',
        intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
      }),
      now: () => Date.parse('2026-10-24T16:01:00.000Z'),
      closeTimeoutMs: 10,
      nativeTransport: {
        timeoutMs: 1000,
        closeTimeoutMs: 5,
        resolveInstance: async () => [{ address: '1.1.1.1', family: 4 }],
        request(options, callback) {
          calls.push(options);
          const req = new EventEmitter(),
            socket = new EventEmitter();
          let res,
            closed = false;
          socket.encrypted = true;
          socket.authorized = true;
          socket.remoteAddress = '1.1.1.1';
          const close = () => {
            if (closed) return;
            closed = true;
            res?.destroy();
            req.emit('close');
            if (!unclosed) socket.emit('close');
          };
          req.destroy = close;
          socket.destroy = close;
          req.end = () =>
            queueMicrotask(() => {
              req.emit('socket', socket);
              socket.emit('secureConnect');
              res = new PassThrough();
              res.statusCode = status;
              res.headers = {
                'content-type': 'application/json',
                ...(framing ? { 'content-encoding': 'SYNTHETIC_PRIVATE' } : {}),
              };
              res.complete = true;
              callback(res);
              if (!res.destroyed) res.end(Buffer.from(rawBody ?? JSON.stringify(dto)));
              res.once('end', close);
            });
          return req;
        },
      },
    },
  };
}
test('native31130 diagnostic uses actual streaming native reader and transport for exactly one charged metadata GET', async () => {
  const f = native31130Fixture(execution31130Dto());
  let charges = 0,
    closed = false;
  const r = await inventory.runNativeExecution31130MetadataDiagnostic(key, {
    ...f.options,
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
  });
  assert.equal(r.status, 'native_metadata_verified');
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/api/v1/executions/31130?includeData=false');
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(f.calls[0].rejectUnauthorized, true);
  assert.equal(f.calls[0].agent, false);
  assert.equal(f.calls[0].headers['accept-encoding'], 'identity');
  assert.equal(r.metadata.versionMatchesIntent, true);
  assert.equal(r.readerMetadataVerified, true);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.controlReservationConservative, true);
  assert.equal(r.acceptanceProven, false);
  assert.equal(r.readerFailure, null);
  assert.doesNotMatch(
    JSON.stringify(r),
    /Synthetic31130Version|2026-10-24T16|synthetic-diagnostic-key|headers|workflowData|"resultData"/,
  );
});
test('snapshot31130 diagnostic streams exactly one full snapshot through the original native transport and remains forensic only', async () => {
  const snapshot = await snapshot31130Fixture(),
    f = native31130Fixture(snapshot.dto);
  let charges = 0,
    closed = false;
  const r = await inventory.runExecution31130SnapshotDiagnostic(key, {
    ...f.options,
    readContext: () => snapshot.context,
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
  });
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, '/api/v1/executions/31130?includeData=true');
  assert.equal(r.status, 'native_snapshot_classified');
  assert.equal(r.forensics.fields.executedGraphMatches, true);
  assert.deepEqual(r.forensics.childExecutionIds, ['31131']);
  assert.equal(r.readerMetadataVerified, false);
  assert.equal(r.readerState, null);
  assert.equal(r.forensics.nativeTreeSettlementProven, false);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.acceptanceProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|Synthetic owned graph|Call Vimeo|bodyHash|settings|workflowData|"resultData"/,
  );
});
test('category31130 diagnostic reuses the actual native one-GET stream and preserves privacy and closure failures', async () => {
  for (const mode of ['success', 'framing', 'unclosed']) {
    const snapshot = await category31130Fixture(),
      f = native31130Fixture(snapshot.dto, { framing: mode === 'framing', unclosed: mode === 'unclosed' });
    let charges = 0,
      closed = false;
    const r = await inventory.runExecution31130CategoryDiagnostic(key, {
      ...f.options,
      readContext: () => snapshot.context,
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {
          closed = true;
        },
      }),
    });
    assert.equal(charges, 1, mode);
    assert.equal(closed, true, mode);
    assert.equal(f.calls.length, 1, mode);
    assert.equal(f.calls[0].path, '/api/v1/executions/31130?includeData=true');
    assert.equal(
      r.status,
      mode === 'success' ? 'native_snapshot_classified' : 'native_snapshot_failed',
      mode,
    );
    if (mode === 'success') {
      assert.equal(r.forensics.categories.nodes.idAlignedExact, true);
      assert.equal(r.forensics.categories.nodeFields.parameters, true);
      assert.equal(r.networkCompletionVerified, true);
    }
    assert.equal(r.readerMetadataVerified, false);
    assert.equal(r.acceptanceProven, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|Synthetic31130Version|SyntheticNode|Synthetic owned graph|Call Vimeo|bodyHash|workflowData|"resultData"/,
    );
  }
});
test('parameter defaults31130 diagnostic keeps one actual native GET and conservative debit under success or closure failure', async () => {
  for (const mode of ['success', 'framing', 'unclosed']) {
    const f = await parameterDefaults31130Fixture(),
      native = native31130Fixture(f.dto, { framing: mode === 'framing', unclosed: mode === 'unclosed' });
    let charge = 0,
      closed = false;
    const r = await inventory.runExecution31130ParameterDefaultsDiagnostic(key, {
      ...native.options,
      readContext: () => f.context,
      openBudget: () => ({
        admit() {
          charge++;
        },
        close() {
          closed = true;
        },
      }),
    });
    assert.equal(charge, 1);
    assert.equal(closed, true);
    assert.equal(native.calls.length, 1);
    assert.equal(native.calls[0].path, '/api/v1/executions/31130?includeData=true');
    assert.equal(r.status, mode === 'success' ? 'native_snapshot_classified' : 'native_snapshot_failed');
    if (mode === 'success') assert.equal(r.forensics.parameterDefaults.fields.graphQualified, true);
    assert.equal(r.acceptanceProven, false);
    assert.equal(r.readerMetadataVerified, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|Known source Set|SyntheticNode|Synthetic31130Version|bodyHash|workflowData|"resultData"/,
    );
  }
});
async function syntheticExecution31130PublicChain({ throughCategory = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'emr-execution31130-public-')),
    cfg = 'milestones/M03-n8n-foundation/evidence/',
    digest = (v) => createHash('sha256').update(v).digest('hex'),
    originals = new Map(),
    replacements = [],
    put = (p, value) => {
      const path = join(root, p);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, value);
      originals.set(p, Buffer.from(value));
      return path;
    },
    load = (name) => JSON.parse(readFileSync(resolve(cfg + name), 'utf8')),
    save = (name, value, old) => {
      const text = JSON.stringify(value) + '\n';
      put(cfg + name, text);
      if (old) replacements.push([old, digest(text)]);
      return digest(text);
    },
    bindings = JSON.parse(readFileSync(resolve('n8n/foundation/bindings.dev.json'), 'utf8')),
    transport = JSON.parse(readFileSync(resolve('n8n/foundation/transport.dev.json'), 'utf8')),
    records = Object.keys(bindings.workflowRefs).map((k) =>
      JSON.parse(readFileSync(resolve('n8n/workflows/' + k + '.json'), 'utf8')),
    ),
    setup = {
      event: 'setup_verified',
      kind: 'deployment',
      deploymentId: 'dpl_SyntheticPublicSource',
      audience: 'https://everyone-market-researcher-synthetic-public-only.vercel.app',
    },
    [{ materializeFoundationAcceptanceCase }, { graphBody }, retention, { foundationRuntimeGraphHash }] =
      await Promise.all([
        import('../../n8n/foundation/materialize-acceptance-case.mjs'),
        import('./foundation-bind.mjs'),
        import('./foundation-retention-proposal.mjs'),
        import('./foundation-runtime-checkpoint.mjs'),
      ]);
  const graph = materializeFoundationAcceptanceCase(
      bindings,
      {
        audience: setup.audience,
        windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
        credential: transport.credential,
      },
      'dispatch.vimeo',
    ),
    body = graphBody(graph);
  body.settings = retention.applyFoundationApprovedRetentionSettings(
    retention.createFoundationApprovedRetentionPolicy({ bindings, records }),
    graph.key,
    body.settings,
  );
  body.settings.availableInMCP = true;
  for (const n of body.nodes)
    if (
      n.type !== 'n8n-nodes-base.manualTrigger' &&
      (/Trigger$/.test(n.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.form'].includes(n.type))
    )
      n.disabled = true;
  const hash = foundationRuntimeGraphHash(body),
    main = load('dev-acceptance-technical16-reconciliation-20261024.json');
  for (const path of Object.keys(main.pins)) {
    const text = path.endsWith('/control.jsonl')
      ? JSON.stringify({
          event: 'native_start_ack',
          caseId: 'dispatch.vimeo',
          workflowKey: 'WF-00',
          workflowId: 'MzimjpsuyPuK7SKe',
          versionId: 'Synthetic31130Version',
          executionId: '31130',
          intentAt: '2026-10-24T16:00:00.000Z',
        }) + '\n'
      : path.endsWith('/runtime.technical-16.jsonl')
        ? [
            { event: 'intent', sequence: 37, action: 'save', key: 'WF-00', target: { graphHash: hash } },
            {
              event: 'verified',
              sequence: 37,
              after: { versionId: 'Synthetic31130Version', graphHash: hash },
            },
          ]
            .map(JSON.stringify)
            .join('\n') + '\n'
        : path.endsWith('/setup.jsonl')
          ? JSON.stringify(setup) + '\n'
          : 'synthetic-public-pinned-bytes\n';
    put(path, text);
    main.pins[path] = digest(text);
  }
  const mainSha = save(
      'dev-acceptance-technical16-reconciliation-20261024.json',
      main,
      'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb',
    ),
    cleanup = load('dev-acceptance-technical16-cleanup-20261024.json');
  cleanup.attemptReceiptSha256 = mainSha;
  save(
    'dev-acceptance-technical16-cleanup-20261024.json',
    cleanup,
    '49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57',
  );
  const claim = (name, m, c, ordinal, control) => {
    const p = 'scripts/n8n/out/foundation/execution-31130-' + name + '-diagnostic-20261024.jsonl',
      text =
        [
          {
            kind: 'm03_execution_31130_' + name.replaceAll('-', '_') + '_diagnostic_budget',
            checkpointSha256: mainSha,
            managementAttempts: m,
            controlAttempts: c,
          },
          { event: 'management_attempt', ordinal },
          ...(control
            ? [{ event: 'native_read_control_reservation', ordinal: control, additionalHttpRequest: false }]
            : []),
        ]
          .map(JSON.stringify)
          .join('\n') + '\n';
    put(p, text);
    return [p, digest(text)];
  };
  const [metadataClaim, metadataClaimSha] = claim('metadata', 824, 955, 825),
    metadata = load('technical16-execution31130-metadata-readback-20261024.json');
  metadata.originalAttemptSha256 = mainSha;
  metadata.pins[metadataClaim] = metadataClaimSha;
  const metadataSha = save(
      'technical16-execution31130-metadata-readback-20261024.json',
      metadata,
      'ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470',
    ),
    [nativeClaim, nativeClaimSha] = claim('native-metadata', 825, 955, 826, 956),
    native = load('technical16-execution31130-native-metadata-readback-20261024.json');
  native.originalAttemptSha256 = mainSha;
  native.metadataReadbackSha256 = metadataSha;
  native.pins[nativeClaim] = nativeClaimSha;
  const nativeSha = save(
      'technical16-execution31130-native-metadata-readback-20261024.json',
      native,
      'd82862ef3c23f9a4dc51b5a7b246c239890acdcda6df31d2a81c7101f21cd057',
    ),
    ui = load('technical16-child-ui-readback-20261024.json');
  ui.nativeMetadataReadbackSha256 = nativeSha;
  put(ui.screenshot.path, 'synthetic-public-child-image');
  ui.screenshot.sha256 = digest('synthetic-public-child-image');
  const uiSha = save(
      'technical16-child-ui-readback-20261024.json',
      ui,
      '2c9100fd58caf7715838462de11337e8d06bcd691ab13b20b380413b6c3e4ba3',
    ),
    [snapshotClaim, snapshotClaimSha] = claim('snapshot', 826, 957, 827, 958),
    snapshot = load('technical16-execution31130-native-snapshot-readback-20261024.json');
  snapshot.originalAttemptSha256 = mainSha;
  snapshot.nativeMetadataReadbackSha256 = nativeSha;
  snapshot.childUiReadbackSha256 = uiSha;
  snapshot.pins[snapshotClaim] = snapshotClaimSha;
  const snapshotSha = save(
    'technical16-execution31130-native-snapshot-readback-20261024.json',
    snapshot,
    '6db76fb75d2956c2835c6a9adb5c2bd7700f53b39b377968e8ec4d1139c842e7',
  );
  if (throughCategory) {
    const [p, sha] = claim('category', 827, 958, 828, 959),
      category = load('technical16-execution31130-parameter-category-readback-20261024.json');
    category.originalAttemptSha256 = mainSha;
    category.snapshotReadbackSha256 = snapshotSha;
    category.pins[p] = sha;
    save(
      'technical16-execution31130-parameter-category-readback-20261024.json',
      category,
      '414874a3dc27f724d399e0dad3bc1a07f96a75fe1709175114c6c5084b795a7c',
    );
  }
  put('n8n/foundation/bindings.dev.json', JSON.stringify(bindings));
  put('n8n/foundation/transport.dev.json', JSON.stringify(transport));
  for (const r of records) put('n8n/workflows/' + r.key + '.json', JSON.stringify(r));
  let source = readFileSync(resolve('scripts/n8n/inventory.mjs'), 'utf8');
  for (const [a, b] of replacements) source = source.replaceAll(a, b);
  for (const p of [
    '../../n8n/foundation/materialize-acceptance-case.mjs',
    './foundation-bind.mjs',
    './foundation-retention-proposal.mjs',
    './foundation-runtime-checkpoint.mjs',
  ])
    source = source.replaceAll(
      "import('" + p + "')",
      "import('" + pathToFileURL(resolve('scripts/n8n', p)).href + "')",
    );
  const entry = join(root, 'scripts/n8n/inventory.mjs');
  writeFileSync(entry, source);
  return { root, originals, module: await import(pathToFileURL(entry).href) };
}
test('category31130 public reconstruction and one-use828 debit preserve827 and every original journal', async () => {
  const { root, originals, module } = await syntheticExecution31130PublicChain();
  try {
    const ready = await module.checkExecution31130MetadataDiagnostic(root, 'categories');
    assert.deepEqual(
      [
        ready.managementAttempts,
        ready.controlAttempts,
        ready.combinedAttempts,
        ready.privateRead,
        ready.networkRequests,
      ],
      [827, 958, 1785, false, 0],
    );
    const recordPath = join(root, 'n8n/workflows/WF-00.json'),
      recordText = readFileSync(recordPath, 'utf8');
    writeFileSync(recordPath, recordText.replace('Africa/Cairo', 'SYNTHETIC_PRIVATE_TIMEZONE'));
    await assert.rejects(module.checkExecution31130MetadataDiagnostic(root, 'categories'));
    writeFileSync(recordPath, recordText);
    const budget = await module.openExecution31130MetadataDiagnosticBudget(root, 'categories');
    await assert.rejects(module.openExecution31130MetadataDiagnosticBudget(root, 'categories'));
    const oldClaim = 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl';
    writeFileSync(join(root, oldClaim), Buffer.concat([originals.get(oldClaim), Buffer.from(' ')]));
    assert.throws(() => budget.admit());
    writeFileSync(join(root, oldClaim), originals.get(oldClaim));
    budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-category-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(rows.slice(1), [
      { event: 'management_attempt', ordinal: 828 },
      { event: 'native_read_control_reservation', ordinal: 959, additionalHttpRequest: false },
    ]);
    await assert.rejects(module.checkExecution31130MetadataDiagnostic(root, 'categories'));
    for (const [p, bytes] of originals) assert.deepEqual(readFileSync(join(root, p)), bytes, p);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('parameter defaults31130 public proof pins828 and durably charges829 only once', async () => {
  const { root, originals, module } = await syntheticExecution31130PublicChain({ throughCategory: true });
  try {
    const ready = await module.checkExecution31130MetadataDiagnostic(root, 'parameter_defaults');
    assert.deepEqual(
      [ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [828, 959, 1787],
    );
    const prior = 'scripts/n8n/out/foundation/execution-31130-category-diagnostic-20261024.jsonl',
      budget = await module.openExecution31130MetadataDiagnosticBudget(root, 'parameter_defaults');
    writeFileSync(join(root, prior), Buffer.concat([originals.get(prior), Buffer.from(' ')]));
    assert.throws(() => budget.admit());
    writeFileSync(join(root, prior), originals.get(prior));
    budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    await assert.rejects(module.openExecution31130MetadataDiagnosticBudget(root, 'parameter_defaults'));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-parameter-defaults-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(rows.slice(1), [
      { event: 'management_attempt', ordinal: 829 },
      { event: 'native_read_control_reservation', ordinal: 960, additionalHttpRequest: false },
    ]);
    for (const [p, bytes] of originals) assert.deepEqual(readFileSync(join(root, p)), bytes, p);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('category public-chain fixtures pass when every workstation ignored output read is forbidden', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-public-clean-checkout-'));
  try {
    const preload = join(root, 'deny-workstation-output.mjs');
    writeFileSync(
      preload,
      `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';const original=fs.readFileSync,blocked=${JSON.stringify([resolve('scripts/n8n/out').replaceAll('\\', '/') + '/', resolve('scripts/db/out').replaceAll('\\', '/') + '/'])};fs.readFileSync=function(path,...args){const value=resolve(path instanceof URL?fileURLToPath(path):String(path)).replaceAll('\\\\','/');if(blocked.some(p=>value.startsWith(p)))throw Error('WORKSTATION_IGNORED_OUTPUT_FORBIDDEN');return original.call(this,path,...args);};syncBuiltinESMExports();`,
    );
    const env = Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
          .filter((k) => process.env[k] !== undefined)
          .map((k) => [k, process.env[k]]),
      ),
      r = spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(preload).href,
          '--test',
          '--test-name-pattern=^(category31130 public reconstruction|parameter defaults31130 public proof)',
          resolve('scripts/n8n/inventory-diagnostics.test.mjs'),
        ],
        { env, encoding: 'utf8', windowsHide: true, timeout: 15000 },
      );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stderr, '');
    assert.match(r.stdout, /pass 2/);
    assert.doesNotMatch(r.stdout, /WORKSTATION_IGNORED_OUTPUT_FORBIDDEN/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('native31130 diagnostic retains fixed native projection or transport failure and never requests full data', async () => {
  for (const mode of ['nullableVersion', 'differentVersion', 'framing', 'unclosed']) {
    const dto = execution31130Dto();
    if (mode === 'nullableVersion') dto.workflowVersionId = null;
    if (mode === 'differentVersion') dto.workflowVersionId = 'SYNTHETIC_PRIVATE';
    const f = native31130Fixture(dto, { framing: mode === 'framing', unclosed: mode === 'unclosed' });
    let charges = 0;
    const r = await inventory.runNativeExecution31130MetadataDiagnostic(key, {
      ...f.options,
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {},
      }),
    });
    assert.equal(charges, 1, mode);
    assert.equal(f.calls.length, 1, mode);
    assert.equal(r.status, 'native_metadata_failed', mode);
    assert.equal(r.acceptanceProven, false);
    if (mode === 'nullableVersion') assert.equal(r.readerFailure.code, 'METADATA');
    if (mode === 'differentVersion') {
      assert.equal(r.readerMetadataVerified, true);
      assert.equal(r.metadata.versionMatchesIntent, false);
    }
    if (mode === 'unclosed') assert.equal(r.networkCompletionVerified, false);
    assert.doesNotMatch(
      JSON.stringify(r),
      /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|headers|workflowData|"resultData"/,
    );
  }
});
const execution31130Dto = () => ({
  id: '31130',
  workflowId: 'MzimjpsuyPuK7SKe',
  workflowVersionId: 'Synthetic31130Version',
  mode: 'manual',
  status: 'success',
  finished: true,
  createdAt: '2026-10-24T16:00:00.000Z',
  startedAt: '2026-10-24T16:00:00.100Z',
  stoppedAt: '2026-10-24T16:00:02.047Z',
  waitTill: null,
});
test('execution31130 fixed classifier makes one charged metadata GET and emits only bounded predicates', async () => {
  let calls = 0,
    charges = 0,
    closed = false;
  const r = await inventory.runExecution31130MetadataDiagnostic(key, {
    readContext: () => ({
      versionId: 'Synthetic31130Version',
      intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
    }),
    now: () => Date.parse('2026-10-24T16:01:00.000Z'),
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {
        closed = true;
      },
    }),
    transport: async (input) => {
      calls++;
      assert.equal(charges, 1);
      assert.equal(
        input.url.href,
        'https://muhhammedsayed.app.n8n.cloud/api/v1/executions/31130?includeData=false',
      );
      assert.equal(input.method, 'GET');
      assert.equal(input.maxBytes, 65536);
      assert.equal(input.rejectUnauthorized, true);
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      return {
        status: 200,
        body: Buffer.from(JSON.stringify({ ...execution31130Dto(), ignored: 'SYNTHETIC_PRIVATE' })),
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(charges, 1);
  assert.equal(closed, true);
  assert.equal(r.status, 'execution_metadata_classified');
  assert.equal(r.fields.readerMetadataContractSatisfied, true);
  assert.equal(r.metadata.executionId, '31130');
  assert.equal(r.metadata.status, 'success');
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.acceptanceProven, false);
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|workflowData|resultData|"data"/,
  );
});
test('execution31130 classifier reports nullable or missing native fields without accepting or exposing them', async () => {
  for (const mode of [
    'nullableVersion',
    'missingTimes',
    'foreign',
    'payload',
    'unknownStatus',
    'notObject',
  ]) {
    const dto = execution31130Dto();
    if (mode === 'nullableVersion') dto.workflowVersionId = null;
    if (mode === 'missingTimes') delete dto.createdAt;
    if (mode === 'foreign') dto.workflowId = 'SYNTHETIC_PRIVATE';
    if (mode === 'payload') dto.data = { token: 'SYNTHETIC_PRIVATE' };
    if (mode === 'unknownStatus') dto.status = 'SYNTHETIC_PRIVATE';
    const r = await inventory.runExecution31130MetadataDiagnostic(key, {
      readContext: () => ({
        versionId: 'Synthetic31130Version',
        intentAt: Date.parse('2026-10-24T16:00:00.000Z'),
      }),
      now: () => Date.parse('2026-10-24T16:01:00.000Z'),
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({ admit() {}, close() {} }),
      transport: async (input) => {
        input.diagnostic.tlsVerified = true;
        input.onSocketClosed();
        return { status: 200, body: Buffer.from(JSON.stringify(mode === 'notObject' ? [] : dto)) };
      },
    });
    assert.equal(r.status, 'execution_metadata_classified', mode);
    assert.equal(r.fields.readerMetadataContractSatisfied, false, mode);
    if (mode === 'nullableVersion') assert.equal(r.fields.versionNull, true);
    if (mode === 'missingTimes') assert.equal(r.fields.createdAtPresent, false);
    if (mode === 'payload') assert.equal(r.fields.payloadAbsent, false);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|Synthetic31130Version|2026-10-24T16|"data"/);
  }
});
test('execution31130 classifier preserves one charge and fixed failures for HTTP, framing, JSON and closure faults', async () => {
  for (const mode of ['http', 'json', 'oversize', 'tls', 'unclosed', 'throw']) {
    let calls = 0,
      charges = 0,
      closed = false;
    const r = await inventory.runExecution31130MetadataDiagnostic(key, {
      readContext: () => ({ versionId: 'Synthetic31130Version', intentAt: 0 }),
      closeTimeoutMs: 1,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {
          closed = true;
        },
      }),
      transport: async (input) => {
        calls++;
        input.diagnostic.tlsVerified = mode !== 'tls';
        if (mode !== 'unclosed') input.onSocketClosed();
        if (mode === 'throw') throw Error('SYNTHETIC_PRIVATE');
        return {
          status: mode === 'http' ? 403 : 200,
          body:
            mode === 'oversize'
              ? Buffer.alloc(65537)
              : Buffer.from(mode === 'json' ? 'SYNTHETIC_PRIVATE' : JSON.stringify(execution31130Dto())),
        };
      },
    });
    assert.equal(calls, 1, mode);
    assert.equal(charges, 1, mode);
    assert.equal(closed, true, mode);
    assert.notEqual(r.status, 'execution_metadata_classified', mode);
    assert.equal(r.fields, null, mode);
    assert.equal(r.metadata, null, mode);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|Synthetic31130Version|\/api\//);
  }
});
test('execution31130 public gate pins closed16 and durably charges825 once without rewriting prior journals', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-execution31130-budget-'));
  try {
    const receiptPath =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json',
      cleanupPath = 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json',
      receipt = JSON.parse(readFileSync(resolve(receiptPath), 'utf8')),
      cleanup = JSON.parse(readFileSync(resolve(cleanupPath), 'utf8')),
      digest = (text) => createHash('sha256').update(text).digest('hex'),
      put = (path, text) => {
        const file = join(root, path);
        mkdirSync(resolve(file, '..'), { recursive: true });
        writeFileSync(file, text);
        return file;
      },
      originals = {};
    for (const path of Object.keys(receipt.pins)) {
      const text = path.endsWith('/control.jsonl')
        ? JSON.stringify({
            event: 'native_start_ack',
            caseId: 'dispatch.vimeo',
            workflowKey: 'WF-00',
            workflowId: 'MzimjpsuyPuK7SKe',
            versionId: 'Synthetic31130Version',
            executionId: '31130',
            intentAt: '2026-10-24T16:00:00.000Z',
          }) + '\n'
        : path.endsWith('/runtime.technical-16.jsonl')
          ? [
              {
                event: 'intent',
                sequence: 37,
                action: 'save',
                key: 'WF-00',
                target: { graphHash: 'a'.repeat(64) },
              },
              {
                event: 'verified',
                sequence: 37,
                after: { versionId: 'Synthetic31130Version', graphHash: 'a'.repeat(64) },
              },
            ]
              .map(JSON.stringify)
              .join('\n') + '\n'
          : 'synthetic-public-pinned-bytes\n';
      put(path, text);
      receipt.pins[path] = digest(text);
      originals[path] = text;
    }
    const receiptText = JSON.stringify(receipt) + '\n';
    cleanup.attemptReceiptSha256 = digest(receiptText);
    const cleanupText = JSON.stringify(cleanup) + '\n';
    put(receiptPath, receiptText);
    put(cleanupPath, cleanupText);
    const source = readFileSync(resolve('scripts/n8n/inventory.mjs'), 'utf8')
      .replace('d6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb', digest(receiptText))
      .replace('49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57', digest(cleanupText));
    const module = await import(pathToFileURL(put('scripts/n8n/inventory.mjs', source)).href);
    const ready = module.checkExecution31130MetadataDiagnostic(root);
    assert.deepEqual(
      [
        ready.managementAttempts,
        ready.controlAttempts,
        ready.combinedAttempts,
        ready.maximumRequests,
        ready.privateRead,
        ready.networkRequests,
      ],
      [824, 955, 1779, 1, false, 0],
    );
    put(cleanupPath, cleanupText + ' ');
    assert.throws(() => module.checkExecution31130MetadataDiagnostic(root));
    put(cleanupPath, cleanupText);
    const budget = module.openExecution31130MetadataDiagnosticBudget(root);
    assert.throws(() => module.openExecution31130MetadataDiagnosticBudget(root));
    budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    assert.throws(() => module.checkExecution31130MetadataDiagnostic(root));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], { event: 'management_attempt', ordinal: 825 });
    const metadataPath =
        'milestones/M03-n8n-foundation/evidence/technical16-execution31130-metadata-readback-20261024.json',
      metadataReceipt = JSON.parse(readFileSync(resolve(metadataPath), 'utf8')),
      oldClaim = 'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl';
    metadataReceipt.originalAttemptSha256 = digest(receiptText);
    metadataReceipt.pins[oldClaim] = digest(readFileSync(join(root, oldClaim)));
    const metadataText = JSON.stringify(metadataReceipt) + '\n';
    put(metadataPath, metadataText);
    put(
      'scripts/n8n/inventory.mjs',
      source.replace(
        'ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470',
        digest(metadataText),
      ),
    );
    const native = await import(pathToFileURL(join(root, 'scripts/n8n/inventory.mjs')).href + '?native'),
      nativeReady = native.checkExecution31130MetadataDiagnostic(root, true),
      oldClaimText = readFileSync(join(root, oldClaim), 'utf8');
    assert.deepEqual(
      [nativeReady.managementAttempts, nativeReady.controlAttempts, nativeReady.combinedAttempts],
      [825, 955, 1780],
    );
    const nativeBudget = native.openExecution31130MetadataDiagnosticBudget(root, true);
    assert.throws(() => native.openExecution31130MetadataDiagnosticBudget(root, true));
    nativeBudget.admit();
    assert.throws(() => nativeBudget.admit());
    nativeBudget.close();
    const nativeRows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(nativeRows[0].managementAttempts, 825);
    assert.equal(nativeRows[0].controlAttempts, 955);
    assert.deepEqual(nativeRows.slice(1), [
      { event: 'management_attempt', ordinal: 826 },
      { event: 'native_read_control_reservation', ordinal: 956, additionalHttpRequest: false },
    ]);
    assert.throws(() => native.checkExecution31130MetadataDiagnostic(root, true));
    assert.equal(readFileSync(join(root, oldClaim), 'utf8'), oldClaimText);
    const nativePath =
        'milestones/M03-n8n-foundation/evidence/technical16-execution31130-native-metadata-readback-20261024.json',
      uiPath = 'milestones/M03-n8n-foundation/evidence/technical16-child-ui-readback-20261024.json',
      nativeReceipt = JSON.parse(readFileSync(resolve(nativePath), 'utf8')),
      ui = JSON.parse(readFileSync(resolve(uiPath), 'utf8')),
      nativeClaim = 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl',
      nativeClaimText = readFileSync(join(root, nativeClaim), 'utf8');
    nativeReceipt.originalAttemptSha256 = digest(receiptText);
    nativeReceipt.metadataReadbackSha256 = digest(metadataText);
    nativeReceipt.pins[nativeClaim] = digest(nativeClaimText);
    const nativeText = JSON.stringify(nativeReceipt) + '\n';
    put(nativePath, nativeText);
    ui.nativeMetadataReadbackSha256 = digest(nativeText);
    put(ui.screenshot.path, 'synthetic-public-child-image');
    ui.screenshot.sha256 = digest('synthetic-public-child-image');
    const uiText = JSON.stringify(ui) + '\n';
    put(uiPath, uiText);
    put(
      'scripts/n8n/inventory.mjs',
      source
        .replace('ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470', digest(metadataText))
        .replace('d82862ef3c23f9a4dc51b5a7b246c239890acdcda6df31d2a81c7101f21cd057', digest(nativeText))
        .replace('2c9100fd58caf7715838462de11337e8d06bcd691ab13b20b380413b6c3e4ba3', digest(uiText)),
    );
    const snapshot = await import(pathToFileURL(join(root, 'scripts/n8n/inventory.mjs')).href + '?snapshot'),
      snapshotReady = snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot');
    assert.deepEqual(
      [snapshotReady.managementAttempts, snapshotReady.controlAttempts, snapshotReady.combinedAttempts],
      [826, 957, 1783],
    );
    put(uiPath, uiText + ' ');
    assert.throws(() => snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot'));
    put(uiPath, uiText);
    const snapshotBudget = snapshot.openExecution31130MetadataDiagnosticBudget(root, 'snapshot');
    snapshotBudget.admit();
    snapshotBudget.close();
    assert.throws(() => snapshot.checkExecution31130MetadataDiagnostic(root, 'snapshot'));
    const snapshotRows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(snapshotRows.slice(1), [
      { event: 'management_attempt', ordinal: 827 },
      { event: 'native_read_control_reservation', ordinal: 958, additionalHttpRequest: false },
    ]);
    assert.equal(readFileSync(join(root, nativeClaim), 'utf8'), nativeClaimText);
    for (const [path, text] of Object.entries(originals))
      assert.equal(readFileSync(join(root, path), 'utf8'), text);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('WF00 execution diagnostic makes only three charged fixed GETs and never adopts an unretained run', async () => {
  const calls = [],
    charges = [];
  let budgetClosed = false;
  const r = await inventory.runWf00ExecutionDiagnostic(key, {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges.push(charges.length + 525);
      },
      close() {
        budgetClosed = true;
      },
    }),
    transport: async (input) => {
      calls.push(input);
      assert.equal(charges.length, calls.length);
      assert.equal(input.method, 'GET');
      assert.equal(input.url.hostname, 'muhhammedsayed.app.n8n.cloud');
      assert.equal(input.rejectUnauthorized, true);
      assert.equal(input.maxBytes, calls.length === 3 ? 524288 : 65536);
      input.diagnostic.tcpConnected = true;
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      return {
        status: 200,
        body: Buffer.from(
          JSON.stringify(
            calls.length === 3
              ? baselineFixture().dto
              : { data: [], nextCursor: null, ignored: 'SYNTHETIC_PRIVATE' },
          ),
        ),
      };
    },
  });
  assert.deepEqual(
    calls.map((c) => c.url.pathname + c.url.search),
    [
      '/api/v1/executions?workflowId=MzimjpsuyPuK7SKe&includeData=false&limit=2&status=running',
      '/api/v1/executions?workflowId=MzimjpsuyPuK7SKe&includeData=false&limit=2',
      '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
    ],
  );
  assert.deepEqual(charges, [525, 526, 527]);
  assert.equal(r.status, 'execution_metadata_observed');
  assert.equal(r.runningEmpty, true);
  assert.equal(r.runningPaginationComplete, true);
  assert.deepEqual(r.latest, []);
  assert.equal(r.unadmittedExecutionIdEstablished, false);
  assert.equal(r.savedWorkflowVerified, true);
  assert.equal(r.manualRetentionDisabled, true);
  assert.equal(r.allActiveExecutionsAbsentProven, false);
  assert.equal(r.authenticationVerified, true);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(budgetClosed, true);
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|"data"|resultData|workflowData/);
});

test('WF00 execution metadata limits, permission failures and uncertain sockets stop without retry or payload output', async () => {
  for (const mode of ['http', 'foreign', 'payload', 'duplicate', 'too-large', 'unclosed']) {
    let calls = 0,
      charges = 0,
      closed = false;
    const r = await inventory.runWf00ExecutionDiagnostic(key, {
      closeTimeoutMs: 1,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      openBudget: () => ({
        admit() {
          charges++;
        },
        close() {
          closed = true;
        },
      }),
      transport: async (input) => {
        calls++;
        input.diagnostic.tcpConnected = true;
        input.diagnostic.tlsVerified = true;
        if (mode !== 'unclosed') input.onSocketClosed();
        const row = {
          id: '12345',
          workflowId: 'MzimjpsuyPuK7SKe',
          mode: 'manual',
          status: 'running',
          startedAt: '2026-10-24T15:41:07.249Z',
          stoppedAt: null,
        };
        if (mode === 'foreign') row.workflowId = 'SYNTHETIC_FOREIGN';
        if (mode === 'payload') row.data = { secret: 'SYNTHETIC_PRIVATE' };
        return {
          status: mode === 'http' ? 403 : 200,
          body:
            mode === 'too-large'
              ? Buffer.alloc(65537)
              : Buffer.from(
                  JSON.stringify({
                    data: mode === 'unclosed' ? [] : mode === 'duplicate' ? [row, row] : [row],
                    nextCursor: null,
                    unknown: 'SYNTHETIC_PRIVATE',
                  }),
                ),
        };
      },
    });
    assert.equal(calls, 1, mode);
    assert.equal(charges, 1, mode);
    assert.equal(closed, true, mode);
    assert.notEqual(r.status, 'execution_metadata_observed', mode);
    assert.equal(r.unadmittedExecutionIdEstablished, false);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|SYNTHETIC_FOREIGN|resultData|"data"/);
  }
});

test('WF00 retained metadata is a bounded candidate and cursors never create extra requests or execution authority', async () => {
  let calls = 0,
    charges = 0;
  const r = await inventory.runWf00ExecutionDiagnostic(key, {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    openBudget: () => ({
      admit() {
        charges++;
      },
      close() {},
    }),
    transport: async (input) => {
      calls++;
      input.diagnostic.tcpConnected = true;
      input.diagnostic.tlsVerified = true;
      input.onSocketClosed();
      const row = {
        id: '12345',
        workflowId: 'MzimjpsuyPuK7SKe',
        mode: 'manual',
        status: 'error',
        startedAt: '2026-10-24T15:41:07.249Z',
        stoppedAt: '2026-10-24T15:41:09.628Z',
        unknown: 'SYNTHETIC_PRIVATE',
      };
      return {
        status: 200,
        body: Buffer.from(
          JSON.stringify(
            calls === 3
              ? baselineFixture((dto) => {
                  dto.versionId = 'ChangedVersion';
                }).dto
              : { data: calls === 1 ? [] : [row], nextCursor: 'SYNTHETIC_OPAQUE_CURSOR' },
          ),
        ),
      };
    },
  });
  assert.equal(calls, 3);
  assert.equal(charges, 3);
  assert.equal(r.status, 'execution_metadata_observed');
  assert.equal(r.runningEmpty, false);
  assert.equal(r.runningPaginationComplete, false);
  assert.equal(r.latestPaginationComplete, false);
  assert.equal(r.latest[0].executionId, '12345');
  assert.equal(r.latest[0].withinObservedInterval, true);
  assert.equal(r.unadmittedExecutionIdEstablished, false);
  assert.equal(r.allActiveExecutionsAbsentProven, false);
  assert.equal(r.savedWorkflowVerified, false);
  assert.equal(r.baseline.versionMatches, false);
  assert.equal(r.manualRetentionDisabled, true);
  assert.doesNotMatch(JSON.stringify(r), /ChangedVersion|SYNTHETIC_PRIVATE|SYNTHETIC_OPAQUE_CURSOR/);
});

test('WF00 diagnostic one-use journal durably charges three reads without rewriting the six prior ledgers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf00-metadata-budget-'));
  try {
    const checkpointPath =
        'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-checkpoint-20261024.json',
      checkpoint = JSON.parse(readFileSync(resolve(checkpointPath), 'utf8')),
      put = (path, text) => {
        const absolute = join(root, path);
        mkdirSync(resolve(absolute, '..'), { recursive: true });
        writeFileSync(absolute, text);
        return absolute;
      },
      digest = (text) => createHash('sha256').update(text).digest('hex'),
      originals = {};
    for (const path of Object.keys(checkpoint.pins)) {
      const text = JSON.stringify({ kind: 'synthetic_public_ledger', path }) + '\n';
      put(path, text);
      originals[path] = text;
      checkpoint.pins[path] = digest(text);
    }
    const text = JSON.stringify(checkpoint) + '\n';
    put(checkpointPath, text);
    const source = readFileSync(resolve('scripts/n8n/inventory.mjs'), 'utf8').replace(
        '9c49750496d602781903de09459d729c6a3061b433a78cfea6aabdb4d796e99f',
        digest(text),
      ),
      path = put('scripts/n8n/inventory.mjs', source),
      module = await import(pathToFileURL(path).href),
      ready = module.checkWf00ExecutionDiagnostic(root);
    assert.equal(ready.privateRead, false);
    assert.equal(ready.networkRequests, 0);
    assert.deepEqual(
      [ready.managementAttempts, ready.controlAttempts, ready.combinedAttempts],
      [524, 846, 1370],
    );
    const budget = module.openWf00ExecutionDiagnosticBudget(root);
    assert.throws(() => module.openWf00ExecutionDiagnosticBudget(root));
    for (let i = 0; i < 3; i++) budget.admit();
    assert.throws(() => budget.admit());
    budget.close();
    assert.throws(() => module.checkWf00ExecutionDiagnostic(root));
    const rows = readFileSync(
      join(root, 'scripts/n8n/out/foundation/wf00-execution-diagnostic-20261024.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.slice(1).map((v) => v.ordinal),
      [525, 526, 527],
    );
    for (const [path, before] of Object.entries(originals))
      assert.equal(readFileSync(join(root, path), 'utf8'), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime residual workflow projection compares only known graph/version/publication profiles', async () => {
  const graph = { name: 'Synthetic owned workflow', nodes: [], connections: {}, settings: {} };
  const { foundationRuntimeGraphHash } = await import('./foundation-runtime-checkpoint.mjs');
  const state = {
    versionId: 'KnownVersion13',
    activeVersionId: null,
    graphHash: foundationRuntimeGraphHash(graph),
    publishedHash: null,
  };
  const expected = {
    id: 'tiEhU3dXrMifOnTL',
    tags: [],
    before: state,
    target: state,
    baseline: { ...state, versionId: 'KnownBaseline' },
  };
  const dto = {
    ...graph,
    id: expected.id,
    versionId: state.versionId,
    active: false,
    activeVersionId: null,
    isArchived: false,
    tags: [],
    shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
    pinData: {},
    privateUnknown: 'SYNTHETIC_PRIVATE_VALUE',
  };
  const result = await inventory.projectRuntimeReconciliationWorkflow(dto, expected);
  assert.equal(result.beforeGraphEqual, true);
  assert.equal(result.targetGraphEqual, true);
  assert.equal(result.versionMatchesBefore, true);
  assert.equal(result.versionMatchesTarget, true);
  assert.equal(result.versionMatchesBaseline, false);
  assert.equal(result.publicationMatchesTarget, true);
  assert.ok(Object.values(result).every((v) => typeof v === 'boolean'));
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC|KnownVersion|tiEh|privateUnknown/);
  const changed = await inventory.projectRuntimeReconciliationWorkflow(
    { ...dto, versionId: 'UnknownPrivateVersion', settings: { unknown: true } },
    expected,
  );
  assert.equal(changed.targetGraphEqual, false);
  assert.equal(changed.versionMatchesTarget, false);
});
function runtimeResidualFixture({ status = 200, failAt = 0, unclosedAt = 0, data = false } = {}) {
  const graph = { name: 'Synthetic owned workflow', nodes: [], connections: {}, settings: {} };
  return import('./foundation-runtime-checkpoint.mjs').then(({ foundationRuntimeGraphHash }) => {
    const base = {
      versionId: 'KnownBefore',
      activeVersionId: null,
      graphHash: foundationRuntimeGraphHash(graph),
      publishedHash: null,
    };
    const expected = Object.fromEntries(
      [
        ['SUB-NOTIFY', 'tiEhU3dXrMifOnTL'],
        ['WF-90', 'S9NHRkKFUIiXX2wv'],
      ].map(([key, id]) => [key, { id, tags: [], baseline: base, before: base, target: base }]),
    );
    const machine = {
      id: 'EmrM03Machine19',
      name: 'M03 foundation machine [dev]',
      createdAt: '2026-10-19T00:25:21.669Z',
      type: 'httpCustomAuth',
      updatedAt: '2026-10-24T00:00:00.000Z',
      ...(data ? { data: { secret: 'SYNTHETIC_PRIVATE_RESPONSE' } } : {}),
    };
    const calls = [],
      charges = [];
    let closed = false;
    return {
      calls,
      charges,
      closed: () => closed,
      dependencies: {
        timeoutMs: 1000,
        closeTimeoutMs: 1,
        lookup: async () => [{ address: '1.1.1.1', family: 4 }],
        openBudget: async () => ({
          context: { plan: { machine }, state: { machineUpdatedAt: machine.updatedAt }, expected },
          admit() {
            charges.push(charges.length + 484);
          },
          close() {
            closed = true;
          },
        }),
        transport: async (input) => {
          calls.push(input);
          assert.equal(charges.length, calls.length);
          assert.equal(input.method, 'GET');
          assert.equal(input.url.hostname, 'muhhammedsayed.app.n8n.cloud');
          assert.equal(input.rejectUnauthorized, true);
          const d = input.diagnostic;
          d.tcpConnected = true;
          d.tlsVerified = true;
          if (calls.length !== unclosedAt) input.onSocketClosed();
          const which = input.url.pathname.split('/').at(-1);
          const dto =
            which === 'EmrM03Machine19'
              ? machine
              : {
                  ...graph,
                  id: which,
                  versionId: 'KnownBefore',
                  active: false,
                  activeVersionId: null,
                  isArchived: false,
                  tags: [],
                  shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
                  pinData: {},
                  privateValue: 'SYNTHETIC_PRIVATE_RESPONSE',
                };
          return { status: calls.length === failAt ? status : 200, body: Buffer.from(JSON.stringify(dto)) };
        },
      },
    };
  });
}
test('runtime residual diagnostic issues only3 charged fixed GETs and exposes boolean comparisons', async () => {
  const f = await runtimeResidualFixture(),
    r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'readback_observed');
  assert.equal(r.requestCount, 3);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(f.closed(), true);
  assert.deepEqual(f.charges, [484, 485, 486]);
  assert.deepEqual(
    f.calls.map((v) => v.url.pathname + v.url.search),
    [
      '/api/v1/credentials/EmrM03Machine19',
      '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true',
      '/api/v1/workflows/S9NHRkKFUIiXX2wv?excludePinnedData=true',
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(r),
    /SYNTHETIC_PRIVATE|KnownBefore|2026-10-24T|"data"|"nodes"|"settings"|versionId|sha256/,
  );
  assert.doesNotThrow(() => inventory.assertRuntimeReconciliationReadback(r));
  for (const mutate of [
    (v) => (v.metadata.updatedAtMatchesJournal = false),
    (v) => (v.metadata.dataPresent = true),
    (v) => (v.workflows['SUB-NOTIFY'].targetGraphEqual = false),
    (v) => (v.workflows['WF-90'].publicationMatchesTarget = false),
    (v) => (v.diagnostics.requests[2].tlsVerified = false),
    (v) => (v.privateSecret = 'SYNTHETIC_PRIVATE_VALUE'),
  ]) {
    const copy = structuredClone(r);
    mutate(copy);
    assert.throws(
      () => inventory.assertRuntimeReconciliationReadback(copy),
      /RUNTIME_RECONCILIATION_BLOCKED/,
    );
  }
});
test('runtime residual failures stop without retry and preserve exact charged requests and closure flags', async () => {
  for (const options of [{ failAt: 2, status: 429 }, { unclosedAt: 2 }]) {
    const f = await runtimeResidualFixture(options),
      r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.charges, [484, 485]);
    assert.equal(r.status, options.failAt ? 'http_failed' : 'network_failed');
    assert.equal(r.networkCompletionVerified, Boolean(options.failAt));
    assert.equal(f.closed(), true);
    assert.throws(() => inventory.assertRuntimeReconciliationReadback(r));
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|KnownBefore/);
  }
  const f = await runtimeResidualFixture({ data: true }),
    r = await inventory.runRuntimeReconciliationDiagnostic(key, f.dependencies);
  assert.equal(r.metadata.dataPresent, true);
  assert.throws(() => inventory.assertRuntimeReconciliationReadback(r));
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE_RESPONSE/);
});
test('runtime residual budget writes483to486 once, keeps the old prefix and refuses repeated admission', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-residual-budget-'));
  try {
    const relative = 'management.jsonl',
      path = join(root, relative),
      original = JSON.stringify({ event: 'header' }) + '\n';
    writeFileSync(path, original);
    const context = {
      root,
      receiptSha256: 'a'.repeat(64),
      managementAttempts: 483,
      paths: { management: relative, claim: 'claim.jsonl' },
      pinned: { management: original },
    };
    // Only the independently tested public-context proof is substituted here;
    // the real exclusive marker, synchronous debit, fsync and one-use guard run.
    const text = readFileSync(new URL('./inventory.mjs', import.meta.url), 'utf8').replace(
      /const context\s*=\s*await readRuntimeReconciliationContext\(repositoryRoot\);/,
      `const context=${JSON.stringify(context)};`,
    );
    const entry = join(root, 'inventory.mjs');
    writeFileSync(entry, text);
    const module = await import(pathToFileURL(entry).href);
    const budget = await module.openRuntimeReconciliationDiagnosticBudget(root);
    for (let i = 0; i < 3; i++) budget.admit();
    assert.throws(() => budget.admit(), /RUNTIME_RECONCILIATION_BLOCKED/);
    budget.close();
    assert.equal(
      readFileSync(path, 'utf8'),
      original +
        [473, 474, 475]
          .map((ordinal) => JSON.stringify({ event: 'management_attempt', ordinal }) + '\n')
          .join(''),
    );
    await assert.rejects(
      module.openRuntimeReconciliationDiagnosticBudget(root),
      /RUNTIME_RECONCILIATION_BLOCKED/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
function wf70Fixture(options = {}) {
  const calls = [],
    charges = [];
  return {
    calls,
    charges,
    dependencies: {
      timeoutMs: 1000,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      admitControlAttempt(value) {
        charges.push(value);
      },
      transport: async (input) => {
        calls.push(input.url.toString());
        assert.equal(charges.length, calls.length);
        assert.equal(input.method, 'GET');
        assert.equal(input.rejectUnauthorized, true);
        assert.equal(input.url.searchParams.get('includeData'), 'false');
        assert.equal(input.url.searchParams.get('workflowId'), 'S6KDFsx5IjQRf6tm');
        const diagnostic = input.diagnostic;
        diagnostic.tcpConnected = true;
        diagnostic.tlsVerified = true;
        diagnostic.socketClosed = true;
        input.onSocketClosed();
        const dto = options.dto?.(calls.length) ?? { data: [], nextCursor: null };
        return { status: options.status ?? 200, body: Buffer.from(JSON.stringify(dto)) };
      },
    },
  };
}
test('fixed WF70 discovery uses the same strict reader through an explicit bounded GET adapter and charges before every call', async () => {
  const f = wf70Fixture(),
    r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'discovery_complete');
  assert.equal(r.requestCount, 2);
  assert.equal(r.transportAdapter, 'inventory_bounded_get_adapter');
  assert.equal(r.paginationComplete, true);
  assert.equal(r.candidateCount, 0);
  assert.equal(r.adoptionProven, false);
  assert.equal(r.drainProven, false);
  assert.equal(r.networkCompletionVerified, true);
  assert.equal(r.readerFailure, null);
  assert.equal(f.charges.length, 2);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1], f.calls[0] + '&status=running');
  assert.doesNotMatch(
    JSON.stringify(r),
    /synthetic-diagnostic-key|executionId|cursor|parameters|workflowData|\/api\//,
  );
});
test('WF70 diagnostic retains HTTP/schema failure and page cap without leaking response values or retrying', async () => {
  for (const options of [
    { status: 429, dto: () => ({ message: 'SYNTHETIC_PRIVATE_UPSTREAM' }) },
    {
      dto: () => ({
        data: [
          {
            id: '101',
            workflowId: 'S6KDFsx5IjQRf6tm',
            mode: 'SYNTHETIC_PRIVATE_MODE',
            status: 'running',
            startedAt: null,
            stoppedAt: null,
            waitTill: null,
          },
        ],
        nextCursor: null,
      }),
    },
    { dto: () => ({ data: [], nextCursor: 'SYNTHETIC_PRIVATE_CURSOR' }) },
  ]) {
    const f = wf70Fixture(options),
      r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
    assert.equal(r.status, 'discovery_failed');
    assert.equal(r.paginationComplete, false);
    assert.equal(r.candidateCount, null);
    assert.equal(r.networkCompletionVerified, true);
    assert.ok(r.requestCount <= 2);
    assert.equal(f.calls.length, r.requestCount);
    assert.equal(r.readerFailure.workflowKey, 'WF-70');
    assert.equal(r.readerFailure.httpStatus, options.status ?? 200);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE|synthetic-diagnostic-key|\/api\//);
  }
  const f = wf70Fixture({
    dto: (n) => ({ data: [], nextCursor: n % 2 === 1 ? 'SYNTHETIC_PRIVATE_CURSOR' : null }),
  });
  const r = await inventory.runWf70DiscoveryDiagnostic(key, f.dependencies);
  assert.equal(r.status, 'discovery_complete');
  assert.equal(r.requestCount, 4);
  assert.equal(f.charges.length, 4);
});

test('WF70 budget journal is one-use, preserves baseline counters and durably debits no more than four controls', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf70-budget-'));
  try {
    const directory = join(root, 'scripts/n8n/out/foundation');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'wf70-discovery-diagnostic-20261024.jsonl');
    const header = {
      kind: 'm03_wf70_discovery_budget',
      version: 1,
      receiptSha256: inventory.wf70DiscoveryReceiptSha256,
      managementAttempts: 152,
      controlAttempts: 382,
      combinedAttempts: 534,
      maximumRequests: 4,
      parentProcessId: process.ppid,
    };
    writeFileSync(path, JSON.stringify(header) + '\n');
    const budget = inventory.openWf70DiscoveryBudget(root);
    try {
      for (let i = 0; i < 4; i++) budget.admit({ kind: 'discovery', workflowId: 'S6KDFsx5IjQRf6tm' });
      assert.throws(
        () => budget.admit({ kind: 'discovery', workflowId: 'S6KDFsx5IjQRf6tm' }),
        /WF70_DIAGNOSTIC_BUDGET_BLOCKED/,
      );
    } finally {
      budget.close();
    }
    const rows = readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows[0], header);
    assert.equal(rows[1].event, 'diagnostic_child_claim');
    assert.deepEqual(
      rows.slice(2).map((r) => r.ordinal),
      [383, 384, 385, 386],
    );
    assert.throws(() => inventory.openWf70DiscoveryBudget(root), /WF70_DIAGNOSTIC_BUDGET_BLOCKED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actual native31130 and exact31145 CLI complete the native import cycle and charge one streamed GET', async () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-native31130-cli-'));
  try {
    for (const snapshotMode of [false, true, 'categories', 'parameter_defaults', 'domain_pins']) {
      const domainPins = snapshotMode === 'domain_pins';
      const full = domainPins
        ? await execution31145Fixture()
        : snapshotMode === 'parameter_defaults'
          ? await parameterDefaults31130Fixture()
          : await category31130Fixture();
      const label = domainPins
        ? 'domain-pins'
        : snapshotMode === 'parameter_defaults'
          ? 'parameter-defaults'
          : snapshotMode === 'categories'
            ? 'category'
            : snapshotMode
              ? 'snapshot'
              : 'native';
      const put = (relative, text) => {
          const path = join(root, relative);
          mkdirSync(resolve(path, '..'), { recursive: true });
          writeFileSync(path, text);
          return path;
        },
        instant = Date.now() - 2000,
        dto = {
          ...execution31130Dto(),
          createdAt: new Date(instant).toISOString(),
          startedAt: new Date(instant + 100).toISOString(),
          stoppedAt: new Date(instant + 1100).toISOString(),
        },
        original = readFileSync(new URL('./inventory.mjs', import.meta.url), 'utf8'),
        start = original.indexOf('function readNativeExecution31130Context('),
        end = original.indexOf('export function checkExecution31130MetadataDiagnostic', start);
      assert.ok(start > 0 && end > start);
      // Only the public qualification is synthetic here; separate tests exercise
      // its actual immutable receipt/prefix checks. Keep real CLI, journal,
      // native reader, streaming native transport and circular import topology.
      let source =
        original.slice(0, start) +
        `function readNativeExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {root,versionId:'Synthetic31130Version',intentAt:${instant}};}function readSnapshotExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {...readNativeExecution31130Context(root),bodyHash:${JSON.stringify(full.context.bodyHash)}};}async function readCategoryExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {...readSnapshotExecution31130Context(root),expectedBody:${JSON.stringify(full.context.expectedBody)},categoryPins:{}};}async function readParameterDefaultsExecution31130Context(root=fileURLToPath(new URL('../../',import.meta.url))){return readCategoryExecution31130Context(root); }\n` +
        original.slice(end);
      if (domainPins) {
        const a = source.indexOf('function readExecution31145Context('),
          b = source.indexOf('export function checkExecution31145PinDiagnostic(', a);
        assert.ok(a > 0 && b > a);
        source =
          source.slice(0, a) +
          `function readExecution31145Context(root=fileURLToPath(new URL('../../',import.meta.url))){return {root,pins:{},...${JSON.stringify(full.context)}};}\n` +
          source.slice(b);
      }
      const entry = put('scripts/n8n/inventory.mjs', source),
        entryUrl = pathToFileURL(entry).href,
        actualTransport = pathToFileURL(resolve('scripts/n8n/foundation-native-transport.mjs')).href,
        actualReader = pathToFileURL(resolve('scripts/n8n/foundation-native-reader.mjs')).href;
      put(
        'n8n/foundation/bindings.dev.json',
        readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
      );
      mkdirSync(join(root, 'scripts/n8n/out/foundation'), { recursive: true });
      const dns = put(
          'dns.mjs',
          `export function lookup(_host,_options,done){done(null,[{address:'1.1.1.1',family:4}]);}`,
        ),
        https = put(
          'https.mjs',
          `import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {appendFileSync} from 'node:fs';
export function request(options,callback){if(options.method!=='GET'||options.hostname!=='muhhammedsayed.app.n8n.cloud'||options.path!==${JSON.stringify('/api/v1/executions/' + (domainPins ? '31145' : '31130') + '?includeData=' + String(!!snapshotMode))}||options.rejectUnauthorized!==true||options.agent!==false||options.headers['accept-encoding']!=='identity')throw Error('SYNTHETIC_ROUTE_BLOCKED');appendFileSync(new URL('./calls${label}.txt',import.meta.url),'fixed-get\\n');const req=new EventEmitter(),socket=new EventEmitter();socket.encrypted=true;socket.authorized=true;socket.remoteAddress='1.1.1.1';let res,closed=false;const close=()=>{if(closed)return;closed=true;res?.destroy();req.emit('close');socket.emit('close');};req.destroy=close;socket.destroy=close;req.end=()=>queueMicrotask(()=>{req.emit('socket',socket);socket.emit('secureConnect');res=new PassThrough();res.statusCode=200;res.headers={'content-type':'application/json'};res.complete=true;callback(res);if(!res.destroyed)res.end(Buffer.from(${JSON.stringify(JSON.stringify(snapshotMode ? full.dto : dto))}));res.once('end',close);});return req;}`,
        ),
        preload = put(
          'preload.mjs',
          `import {registerHooks} from 'node:module';registerHooks({resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-live-domain-probe.mjs')return {url:${JSON.stringify(pathToFileURL(resolve('scripts/n8n/foundation-live-domain-probe.mjs')).href)},shortCircuit:true};if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-native-reader.mjs')return {url:${JSON.stringify(actualReader)},shortCircuit:true};if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-native-transport.mjs')return {url:${JSON.stringify(actualTransport)},shortCircuit:true};if(context.parentURL===${JSON.stringify(entryUrl)}&&specifier==='./foundation-runtime-checkpoint.mjs')return {url:${JSON.stringify(pathToFileURL(resolve('scripts/n8n/foundation-runtime-checkpoint.mjs')).href)},shortCircuit:true};if(specifier==='./inventory.mjs'&&context.parentURL?.includes('/scripts/n8n/'))return {url:${JSON.stringify(entryUrl)},shortCircuit:true};if(specifier==='node:dns')return {url:${JSON.stringify(pathToFileURL(dns).href)},shortCircuit:true};if(specifier==='node:https')return {url:${JSON.stringify(pathToFileURL(https).href)},shortCircuit:true};return next(specifier,context);}});`,
        ),
        env = Object.fromEntries(
          ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
            .filter((k) => process.env[k] !== undefined)
            .map((k) => [k, process.env[k]]),
        ),
        r = spawnSync(
          process.execPath,
          [
            '--import',
            pathToFileURL(preload).href,
            entry,
            domainPins
              ? '--execution-31145-pin-diagnostic'
              : snapshotMode === 'parameter_defaults'
                ? '--execution-31130-parameter-defaults-diagnostic'
                : snapshotMode === 'categories'
                  ? '--execution-31130-category-diagnostic'
                  : snapshotMode
                    ? '--execution-31130-snapshot-diagnostic'
                    : '--execution-31130-native-metadata-diagnostic',
          ],
          { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', windowsHide: true, timeout: 10000 },
        );
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stderr, '');
      const result = JSON.parse(r.stdout);
      assert.equal(result.status, snapshotMode ? 'native_snapshot_classified' : 'native_metadata_verified');
      assert.equal(result.networkCompletionVerified, true);
      assert.equal(result.metadata.versionMatchesIntent, true);
      assert.equal(readFileSync(join(root, 'calls' + label + '.txt'), 'utf8'), 'fixed-get\n');
      const rows = readFileSync(
        join(
          root,
          domainPins
            ? 'scripts/n8n/out/foundation/execution-31145-pin-diagnostic-20261025.jsonl'
            : snapshotMode === 'parameter_defaults'
              ? 'scripts/n8n/out/foundation/execution-31130-parameter-defaults-diagnostic-20261024.jsonl'
              : snapshotMode === 'categories'
                ? 'scripts/n8n/out/foundation/execution-31130-category-diagnostic-20261024.jsonl'
                : snapshotMode
                  ? 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl'
                  : 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl',
        ),
        'utf8',
      )
        .trim()
        .split('\n')
        .map(JSON.parse);
      assert.deepEqual(rows.slice(1), [
        {
          event: 'management_attempt',
          ordinal: domainPins
            ? 1640
            : snapshotMode === 'parameter_defaults'
              ? 829
              : snapshotMode === 'categories'
                ? 828
                : snapshotMode
                  ? 827
                  : 826,
        },
        {
          event: 'native_read_control_reservation',
          ordinal: domainPins
            ? 1443
            : snapshotMode === 'parameter_defaults'
              ? 960
              : snapshotMode === 'categories'
                ? 959
                : snapshotMode
                  ? 958
                  : 956,
          additionalHttpRequest: false,
        },
      ]);
      assert.doesNotMatch(
        r.stdout,
        /SYNTHETIC_PRIVATE|Synthetic31130Version|Synthetic31145Version|synthetic-diagnostic-key|headers|workflowData|"resultData"/,
      );
      if (domainPins) {
        const repeated = spawnSync(
          process.execPath,
          ['--import', pathToFileURL(preload).href, entry, '--execution-31145-pin-diagnostic'],
          { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', windowsHide: true, timeout: 10000 },
        );
        assert.equal(repeated.status, 1);
        assert.equal(repeated.stderr, '');
        assert.equal(JSON.parse(repeated.stdout).status, 'budget_blocked');
        assert.equal(readFileSync(join(root, 'calls' + label + '.txt'), 'utf8'), 'fixed-get\n');
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actual diagnostic CLI completes its circular reader imports with synthetic DNS/HTTPS only and records exact charged GETs', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf70-cli-'));
  try {
    const put = (relative, text) => {
      const path = join(root, relative);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, text);
      return path;
    };
    const entry = put('scripts/n8n/inventory.mjs', readFileSync(new URL('./inventory.mjs', import.meta.url)));
    put(
      'n8n/foundation/bindings.dev.json',
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    const journal = put(
      'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl',
      JSON.stringify({
        kind: 'm03_wf70_discovery_budget',
        version: 1,
        receiptSha256: inventory.wf70DiscoveryReceiptSha256,
        managementAttempts: 152,
        controlAttempts: 382,
        combinedAttempts: 534,
        maximumRequests: 4,
        parentProcessId: process.pid,
      }) + '\n',
    );
    const dns = put(
      'dns.mjs',
      `export function lookup(_host,_options,done){done(null,[{address:'1.1.1.1',family:4}]);}`,
    );
    const https = put(
      'https.mjs',
      `import {EventEmitter} from 'node:events';
export function request(url,options,callback){if(options.method!=='GET'||url.hostname!=='muhhammedsayed.app.n8n.cloud'||url.pathname!=='/api/v1/executions'||url.searchParams.get('workflowId')!=='S6KDFsx5IjQRf6tm'||url.searchParams.get('includeData')!=='false')throw Error('SYNTHETIC_ROUTE_BLOCKED');const req=new EventEmitter(),socket=new EventEmitter();socket.encrypted=true;socket.authorized=true;let closed=false;const close=()=>{if(!closed){closed=true;socket.emit('close');}};req.destroy=close;req.end=()=>setImmediate(()=>{req.emit('socket',socket);socket.emit('connect');socket.emit('secureConnect');const response=new EventEmitter();const body=Buffer.from(JSON.stringify({data:[],nextCursor:null}));response.statusCode=200;response.headers={'content-length':String(body.length)};response.complete=true;response.destroy=close;callback(response);response.emit('data',body);response.emit('end');close();});return req;}`,
    );
    const copyUrl = pathToFileURL(entry).href,
      actualReader = pathToFileURL(resolve('scripts/n8n/foundation-native-reader.mjs')).href;
    const preload = put(
      'preload.mjs',
      `import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='./foundation-native-reader.mjs')return {url:${JSON.stringify(actualReader)},shortCircuit:true};if(specifier==='./inventory.mjs'&&context.parentURL?.includes('/scripts/n8n/'))return {url:${JSON.stringify(copyUrl)},shortCircuit:true};if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='node:dns')return {url:${JSON.stringify(pathToFileURL(dns).href)},shortCircuit:true};if(context.parentURL===${JSON.stringify(copyUrl)}&&specifier==='node:https')return {url:${JSON.stringify(pathToFileURL(https).href)},shortCircuit:true};return next(specifier,context);}});`,
    );
    const env = Object.fromEntries(
      ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
        .filter((k) => process.env[k] !== undefined)
        .map((k) => [k, process.env[k]]),
    );
    const r = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(preload).href, entry, '--wf70-discovery-diagnostic'],
      { env: { ...env, M03_N8N_API_KEY: key }, encoding: 'utf8', windowsHide: true, timeout: 10000 },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    const dto = JSON.parse(r.stdout);
    assert.equal(dto.status, 'discovery_complete');
    assert.equal(dto.requestCount, 2);
    assert.equal(dto.networkCompletionVerified, true);
    const rows = readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(
      rows.slice(2).map((r) => r.ordinal),
      [383, 384],
    );
    assert.doesNotMatch(r.stdout, /synthetic-diagnostic-key|x-n8n|executionId|SYNTHETIC/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
const projectId = 'pHvQjDmjxVZ3KQLT';
const payloads = {
  discover: { data: { scopes: [], resources: {}, filters: {}, specUrl: '/api/v1/openapi.yml' } },
  projects: {
    data: [{ id: projectId, name: 'synthetic-private-project-name', type: 'personal' }],
    nextCursor: null,
  },
  workflows: {
    data: [
      {
        id: 'syntheticWorkflow',
        name: 'WF-00 · Orchestrator [dev]',
        active: false,
        isArchived: false,
        shared: [{ projectId, role: 'workflow:owner' }],
      },
    ],
    nextCursor: null,
  },
  credentials: { data: [], nextCursor: null },
};
function fixture(mode = 'success') {
  const state = { requests: 0, closed: 0, options: [] };
  const request = (url, options, callback) => {
    state.requests++;
    state.options.push(options);
    const resource = url.pathname.split('/').at(-1);
    const fault = resource === 'workflows' ? mode : 'success';
    const req = new EventEmitter(),
      socket = new EventEmitter();
    socket.encrypted = true;
    socket.authorized = true;
    let closed = false;
    const close = () => {
      if (!closed) {
        closed = true;
        state.closed++;
        socket.emit('close');
      }
    };
    req.destroy = () => {
      close();
    };
    options.signal.addEventListener('abort', close, { once: true });
    req.end = () => {
      req.emit('socket', socket);
      setImmediate(() => {
        if (fault === 'connect') {
          req.emit('error', Object.assign(new Error('synthetic-private-network'), { code: 'ECONNREFUSED' }));
          close();
          return;
        }
        socket.emit('connect');
        if (['tls', 'tlsExpired', 'tlsHostname'].includes(fault)) {
          req.emit(
            'error',
            Object.assign(new Error('synthetic-private-TLS'), {
              code:
                fault === 'tlsExpired'
                  ? 'CERT_HAS_EXPIRED'
                  : fault === 'tlsHostname'
                    ? 'ERR_TLS_CERT_ALTNAME_INVALID'
                    : 'SELF_SIGNED_CERT_IN_CHAIN',
            }),
          );
          close();
          return;
        }
        socket.emit('secureConnect');
        if (fault === 'status') {
          req.emit('error', Object.assign(new Error('synthetic-private-status'), { code: 'ECONNRESET' }));
          close();
          return;
        }
        const response = new EventEmitter();
        const body =
          fault === 'parse'
            ? Buffer.from('synthetic-private-invalid-json')
            : Buffer.from(
                JSON.stringify(
                  fault === 'schema'
                    ? { data: 'synthetic-private-shape', nextCursor: null }
                    : payloads[resource],
                ),
              );
        response.statusCode = fault === 'http403' ? 403 : 200;
        response.headers = { 'content-length': String(body.length + (fault === 'truncated' ? 1 : 0)) };
        response.destroy = close;
        callback(response);
        response.emit('data', body);
        if (fault === 'bodyAbort') {
          response.emit('aborted');
          close();
          return;
        }
        if (fault === 'bodyTimeout') return;
        response.emit('end');
        close();
      });
    };
    return req;
  };
  const dependencies = {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request,
    // A regression that stops honoring the synthetic native adapter must never
    // fall back to real HTTPS during a local test.
    transport: async () => {
      throw new Error('synthetic-adapter-not-selected');
    },
    timeoutMs: mode === 'bodyTimeout' ? 30 : 1000,
  };
  return { state, dependencies };
}
test('workflow-list diagnostic records only observed safe stages with strict TLS and bounded closed requests', async () => {
  assert.equal(inventoryDiagnosticVersion, 1);
  const f = fixture();
  const result = await runInventory(key, f.dependencies);
  assert.equal(result.status, 'complete');
  assert.equal(result.diagnostics.dns, 'complete');
  assert.equal(result.diagnostics.requests.length, 4);
  const workflow = result.diagnostics.requests[2];
  assert.deepEqual(workflow, {
    resource: 'workflows',
    page: 1,
    tcpConnected: true,
    tlsVerified: true,
    httpStatus: 200,
    bodyRead: 'complete',
    jsonParsed: true,
    schemaValidated: true,
    socketClosed: true,
    failureStage: 'none',
    failureCode: 'none',
  });
  assert.equal(f.state.closed, 4);
  for (const options of f.state.options) {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, 'muhhammedsayed.app.n8n.cloud');
  }
});
for (const [mode, stage, code] of [
  ['connect', 'connect', 'connection_refused'],
  ['tls', 'tls', 'tls_untrusted'],
  ['tlsExpired', 'tls', 'tls_expired'],
  ['tlsHostname', 'tls', 'tls_hostname'],
  ['status', 'status', 'connection_reset'],
  ['bodyAbort', 'body_read', 'body_aborted'],
  ['truncated', 'body_read', 'body_truncated'],
  ['parse', 'parse', 'invalid_json'],
  ['schema', 'schema', 'invalid_schema'],
  ['http403', 'status', 'http_failed'],
  ['bodyTimeout', 'body_read', 'timeout'],
])
  test(`workflow-list ${mode} retains successful auth/project stages and fixed failure classification`, async () => {
    const f = fixture(mode);
    const result = await runInventory(key, f.dependencies);
    assert.equal(result.authenticationVerified, true);
    assert.equal(result.resources.projects.status, 'complete');
    assert.equal(result.resources.projects.httpStatus, 200);
    const workflow = result.diagnostics.requests[2];
    assert.equal(workflow.resource, 'workflows');
    assert.equal(workflow.failureStage, stage);
    assert.equal(workflow.failureCode, code);
    assert.equal(workflow.schemaValidated, false);
    assert.equal(f.state.closed, f.state.requests);
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic-private|synthetic-diagnostic-key|content-length|headers|stack/,
    );
  });
test('unknown injected transport failure remains unknown instead of inventing TLS/status/body proof', async () => {
  const result = await runInventory(key, {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async () => {
      throw new Error('synthetic-private-unknown');
    },
  });
  assert.equal(result.status, 'network_failed');
  assert.equal(result.diagnostics.requests[0].failureStage, 'unknown');
  assert.equal(result.diagnostics.requests[0].tlsVerified, null);
  assert.equal(result.diagnostics.requests[0].httpStatus, null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
});
test('DNS failure stops before requests and retains no invented transport proof', async () => {
  let requests = 0;
  const result = await runInventory(key, {
    lookup: async () => {
      throw new Error('synthetic-private-dns');
    },
    transport: async () => {
      requests++;
    },
  });
  assert.equal(result.diagnostics.dns, 'failed');
  assert.deepEqual(result.diagnostics.requests, []);
  assert.equal(result.requestCount, 0);
  assert.equal(requests, 0);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
});

function baselineFixture(change = () => {}, status = 200) {
  const record = JSON.parse(readFileSync(new URL('../../n8n/workflows/WF-00.json', import.meta.url), 'utf8'));
  const dto = {
    ...structuredClone(record.workflow),
    settings: { ...structuredClone(record.workflow.settings), ...(record.nativeReadonlySettings ?? {}) },
    id: record.id,
    versionId: record.versionId,
    active: false,
    activeVersionId: null,
    isArchived: false,
    shared: [{ projectId, role: 'workflow:owner' }],
    pinData: {},
  };
  change(dto);
  const calls = [];
  return {
    dto,
    calls,
    dependencies: {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request(url, options, callback) {
        calls.push({ url: url.href, options });
        const req = new EventEmitter(),
          socket = new EventEmitter();
        socket.encrypted = true;
        socket.authorized = true;
        let closed = false;
        const close = () => {
          if (!closed) {
            closed = true;
            socket.emit('close');
          }
        };
        req.destroy = close;
        options.signal.addEventListener('abort', close, { once: true });
        req.end = () => {
          req.emit('socket', socket);
          setImmediate(() => {
            socket.emit('connect');
            socket.emit('secureConnect');
            const response = new EventEmitter(),
              body = Buffer.from(JSON.stringify(dto));
            response.statusCode = status;
            response.headers = { 'content-length': String(body.length) };
            response.destroy = close;
            callback(response);
            response.emit('data', body);
            response.emit('end');
            close();
          });
        };
        return req;
      },
      timeoutMs: 1000,
    },
  };
}
test('one owned baseline diagnostic performs exactly one strict GET and projects matching booleans only', async () => {
  const f = baselineFixture();
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'matching_baseline');
  assert.equal(result.requestCount, 1);
  assert.equal(result.authenticationVerified, true);
  assert.equal(result.projectVerified, true);
  assert.equal(result.diagnostics.requests[0].socketClosed, true);
  assert.deepEqual(result.baseline.failedChecks, []);
  assert.equal(f.calls.length, 1);
  assert.equal(
    f.calls[0].url,
    'https://muhhammedsayed.app.n8n.cloud/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
  );
  assert.equal(f.calls[0].options.method, 'GET');
  assert.equal(f.calls[0].options.rejectUnauthorized, true);
  assert.doesNotMatch(
    JSON.stringify(result),
    /"nodes":|"parameters":|"connections":|"settings":|headers|synthetic-diagnostic-key|sha256|versionId/,
  );
});
test('one baseline diagnostic reports all safe mismatch codes, never supplied private values', async () => {
  const f = baselineFixture((dto) => {
    dto.versionId = 'SYNTHETIC_PRIVATE_VERSION';
    dto.settings.private = 'SYNTHETIC_PRIVATE_VALUE';
    dto.name = 'SYNTHETIC_PRIVATE_NAME';
  });
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'baseline_mismatch');
  assert.deepEqual(result.baseline.failedChecks, ['version_mismatch', 'graph_name', 'graph_settings']);
  assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|versionId|sha256|"parameters":/);
});
test('baseline diagnostic refuses reflected key and HTTP denial without retry or DTO export', async () => {
  for (const [change, status, expected] of [
    [
      (dto) => {
        dto.meta = { secret: key };
      },
      200,
      'confidentiality_rejected',
    ],
    [() => {}, 403, 'http_failed'],
  ]) {
    const f = baselineFixture(change, status),
      result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
    assert.equal(result.status, expected);
    assert.equal(result.baseline, null);
    assert.equal(f.calls.length, 1);
    assert.equal(result.diagnostics.requests[0].socketClosed, true);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-diagnostic-key|secret|parameters|versionId/);
  }
});

test('one GET forensics can recognize a reviewed graph variant without claiming pinned baseline or edit provenance', async () => {
  const f = baselineFixture((dto) => {
    delete dto.settings.binaryMode;
    dto.versionId = 'SYNTHETIC_PRIVATE_NEW_VERSION';
    for (const n of dto.nodes) if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
    dto.settings.availableInMCP = true;
    dto.settings.saveManualExecutions = true;
  });
  const result = await inventory.runWorkflowBaselineDiagnostic(key, f.dependencies);
  assert.equal(result.status, 'baseline_mismatch');
  assert.deepEqual(result.baseline.failedChecks, ['version_mismatch', 'graph_nodes', 'graph_settings']);
  assert.equal(result.forensics.knownVariants.stagedC01ManualGraphEqual, true);
  assert.equal(result.forensics.nodeCategories.parametersEqual, true);
  assert.equal(result.forensics.nodeCategories.behaviorEqual, false);
  assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|provenance|"parameters":|versionId/);
});
