import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { inventoryDiagnosticVersion, runInventory } from './inventory.mjs';
import * as inventory from './inventory.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const key = 'synthetic-diagnostic-key-only';
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
