import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { inventoryDiagnosticVersion, runInventory } from './inventory.mjs';
import * as inventory from './inventory.mjs';
import { readFileSync } from 'node:fs';

const key = 'synthetic-diagnostic-key-only';
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
