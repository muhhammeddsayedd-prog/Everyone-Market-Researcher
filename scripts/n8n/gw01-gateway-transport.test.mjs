import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTrialCoordinator, GW01_WINDOW_ID } from './gw01-trial.mjs';
import { sendGatewayAttempt } from './gw01-gateway-transport.mjs';

const roots = [],
  audience = 'https://everyone-market-researcher-synthetic.vercel.app',
  protection = 'SYNTHETIC_PRIVATE_PROTECTION_CANARY_0123456789',
  machine = 'SYNTHETIC_PRIVATE_MACHINE_CANARY_0123456789';
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
function fixture(mode = 'Probe') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-gateway-synthetic-'));
  roots.push(root);
  const coordinator = createTrialCoordinator(root, { windowId: GW01_WINDOW_ID, audiences: [audience] });
  coordinator.prepare();
  if (mode === 'Request') coordinator.start();
  return {
    root,
    coordinator,
    input: {
      mode,
      preview: {
        version: 1,
        projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
        teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
        branch: 'm03-n8n-foundation',
        commitSha: 'a'.repeat(40),
        deploymentId: 'dpl_SyntheticOwnedDeployment123',
        audience,
        target: 'preview',
        protection: 'all_except_custom_domains',
        routeDisabledVerified: true,
      },
      request: { version: 1, requestId: randomUUID(), operation: 'identity.read', args: {} },
      kind: mode === 'Probe' ? 'preflight' : 'ordinary',
      authorization: mode === 'Probe' ? 'synthetic' : 'machine',
      fault: 'none',
      secrets: mode === 'Probe' ? { protection } : { protection, machine },
    },
  };
}
const window = (input) => ({
  id: GW01_WINDOW_ID,
  startsAt: '2026-10-18T08:00:00Z',
  expiresAt: '2026-10-18T08:30:00Z',
  closed: false,
  totalAdmitted: 1,
  boundAudience: input.preview.audience,
  boundCommitSha: input.preview.commitSha,
  boundDeploymentId: input.preview.deploymentId,
});
const identity = {
  currentUser: 'n8n_writer',
  sessionUser: 'n8n_writer',
  database: 'postgres',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  connectionCount: 1,
};
function network(f, scenario = 'success', options = {}) {
  let calls = 0,
    sent,
    written;
  const deps = {
    coordinator: f.coordinator,
    timeoutMs: 50,
    closeTimeoutMs: 20,
    lookup: (_host, settings, callback) => {
      assert.deepEqual(settings, { all: true });
      callback(null, [{ address: '8.8.8.8', family: 4 }]);
    },
    request: (config, callback) => {
      calls++;
      sent = config;
      assert.equal(f.coordinator.snapshot().attempts > 0, true, 'journal reservation precedes transport');
      const req = new EventEmitter(),
        socket = new EventEmitter();
      socket.authorized = scenario !== 'untrusted';
      let res,
        closed = false;
      const close = () => {
        if (closed || scenario === 'never_close') return;
        closed = true;
        setTimeout(() => {
          res?.emit('close');
          req.emit('close');
          socket.emit('close');
        }, options.closeDelayMs ?? 0);
      };
      req.destroy = close;
      req.end = (bytes) => {
        written = bytes;
        queueMicrotask(() => {
          req.emit('socket', socket);
          if (scenario === 'tls') {
            req.emit('error', Error(machine));
            return;
          }
          socket.emit('secureConnect');
          if (scenario === 'untrusted') return;
          res = new EventEmitter();
          res.statusCode = f.input.mode === 'Probe' ? 503 : 200;
          res.headers = { 'content-type': 'application/json' };
          res.complete = scenario !== 'truncated';
          res.destroy = close;
          if (scenario === 'redirect') {
            res.statusCode = 307;
            res.headers.location = 'https://foreign.invalid/' + protection;
          }
          if (scenario === 'large') res.headers['content-length'] = '524289';
          if (scenario === 'encoding') res.headers['content-encoding'] = 'gzip';
          if (scenario === 'length') res.headers['content-length'] = '123456';
          if (scenario === 'html') res.headers['content-type'] = 'text/html';
          let body =
            f.input.mode === 'Probe'
              ? { requestId: null, error: { code: 'unavailable' } }
              : {
                  version: 1,
                  requestId: f.input.request.requestId,
                  outcome: 'completed',
                  result: { ...identity },
                  window: window(f.input),
                };
          if (scenario === 'wrong_identity') body.result.currentUser = 'postgres';
          if (scenario === 'reflected') body.result.currentUser = machine;
          if (scenario === 'extra') body.extra = protection;
          if (scenario === 'wrong_binding') body.window.boundCommitSha = 'b'.repeat(40);
          if (scenario === 'wrong_id') body.requestId = randomUUID();
          if (scenario === 'wrong_probe') body = { requestId: null, error: { code: 'outcome_unknown' } };
          if (scenario === 'denied') {
            res.statusCode = 401;
            body = { requestId: null, error: { code: 'unauthorized' } };
          }
          callback(res);
          if (scenario === 'hang' || scenario === 'never_close') return;
          res.emit('data', Buffer.from(scenario === 'parse' ? '{invalid' : JSON.stringify(body)));
          res.emit('end');
          close();
        });
      };
      return req;
    },
  };
  return { deps, calls: () => calls, sent: () => sent, written: () => written };
}
function safe(result) {
  assert.doesNotMatch(JSON.stringify(result), new RegExp(machine + '|' + protection));
  return result;
}
test('Probe uses only protection plus public synthetic auth, records preflight and verifies disabled503 without identity claim', async () => {
  const f = fixture(),
    n = network(f),
    r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.status, 'complete');
  assert.equal(r.httpStatus, 503);
  assert.equal(r.disabledRouteVerified, true);
  assert.equal(r.identityVerified, false);
  assert.equal(r.tlsVerified, true);
  assert.equal(r.socketsClosed, true);
  assert.equal(f.coordinator.snapshot().attempts, 1);
  assert.equal(f.coordinator.snapshot().startedAt, null);
  assert.equal(n.sent().headers.authorization, 'Bearer GW01_SYNTHETIC_AUTH_CANARY_ONLY_0123456789');
  assert.equal(n.sent().headers['x-vercel-protection-bypass'], protection);
  assert.equal(n.sent().hostname, new URL(audience).hostname);
  assert.equal(n.sent().servername, n.sent().hostname);
  assert.equal(n.sent().port, 443);
  assert.equal(n.sent().path, '/api/internal/n8n/rpc');
  assert.equal(n.sent().method, 'POST');
  assert.equal(n.sent().rejectUnauthorized, true);
  assert.equal(n.sent().agent, false);
  assert.equal(n.sent().minVersion, 'TLSv1.2');
  assert.equal(n.sent().headers.cookie, undefined);
  assert.equal(n.sent().headers.origin, undefined);
  assert.deepEqual(JSON.parse(n.written()), f.input.request);
});
test('real-machine path validates actual typed identity and immutable binding, no raw body fields', async () => {
  const f = fixture('Request'),
    n = network(f),
    r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.status, 'complete');
  assert.equal(r.identityVerified, true);
  assert.deepEqual(r.response.result, identity);
  assert.equal(n.sent().headers.authorization, 'Bearer ' + machine);
  assert.equal(f.coordinator.snapshot().inFlight, 0);
});
test('initial Probe accepts unverified disabled-route flag without assuming its conclusion', async () => {
  const f = fixture(),
    n = network(f);
  f.input.preview.routeDisabledVerified = false;
  const r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.status, 'complete');
  assert.equal(r.disabledRouteVerified, true);
});
test('private value colliding with public request correlation is rejected before journal persistence', async () => {
  const f = fixture('Request'),
    n = network(f);
  f.input.secrets.machine = f.input.request.requestId;
  const r = await sendGatewayAttempt(f.input, n.deps);
  assert.equal(r.attemptRecorded, false);
  assert.equal(r.requestId, null);
  assert.equal(f.coordinator.snapshot().attempts, 0);
  assert.doesNotMatch(
    JSON.stringify(r) + readFileSync(join(f.root, 'gw01-trial.jsonl'), 'utf8'),
    new RegExp(f.input.secrets.machine),
  );
});
test('a private value equal to a fixed diagnostic is withheld from the final projection', async () => {
  const f = fixture('Request'),
    n = network(f);
  f.input.fault = 'after_headers_cancel';
  f.input.secrets.machine = 'GW01_GATEWAY_AFTER_HEADERS_CANCELLED';
  const r = await sendGatewayAttempt(f.input, n.deps);
  assert.equal(r.code, 'GW01_GATEWAY_REDACTED');
  assert.doesNotMatch(JSON.stringify(r), new RegExp(f.input.secrets.machine));
});
for (const scenario of [
  'wrong_identity',
  'reflected',
  'extra',
  'wrong_binding',
  'wrong_id',
  'parse',
  'length',
  'truncated',
  'large',
  'encoding',
  'html',
  'redirect',
  'tls',
  'untrusted',
  'hang',
  'never_close',
])
  test('fails closed without retry/raw data for ' + scenario, async () => {
    const f = fixture('Request'),
      n = network(f, scenario),
      r = safe(await sendGatewayAttempt(f.input, n.deps));
    assert.equal(r.status, 'stopped_reconcile');
    assert.equal(r.response, null);
    assert.equal(r.identityVerified, false);
    assert.equal(n.calls(), 1);
    assert.equal(f.coordinator.snapshot().attempts, 1);
    assert.equal(f.coordinator.snapshot().inFlight, 0);
    assert.equal(r.socketsClosed, scenario !== 'never_close');
    assert.equal(
      JSON.parse(readFileSync(join(f.root, 'gw01-trial.jsonl'), 'utf8').trim().split('\n').at(-1)).outcome,
      'unknown',
    );
  });
test('unavailable is required exactly for Probe; arbitrary503 is not Cloud B proof', async () => {
  const f = fixture(),
    n = network(f, 'wrong_probe'),
    r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.status, 'stopped_reconcile');
  assert.equal(r.disabledRouteVerified, false);
});
for (const edit of [
  (i) => {
    i.preview.target = 'production';
  },
  (i) => {
    i.preview.protection = 'disabled';
  },
  (i) => {
    i.preview.projectId = 'prj_other';
  },
  (i) => {
    i.preview.audience += '/foreign';
  },
  (i) => {
    i.preview.branch = 'main';
  },
  (i) => {
    i.secrets.writer = 'SYNTHETIC_FORBIDDEN';
  },
  (i) => {
    i.request.args.extra = 'SYNTHETIC_FORBIDDEN';
  },
  (i) => {
    i.kind = 'ordinary';
  },
])
  test('rejects invalid public target/input before any reservation or DNS', async () => {
    const f = fixture();
    edit(f.input);
    const n = network(f);
    n.deps.lookup = () => assert.fail('no DNS');
    const r = safe(await sendGatewayAttempt(f.input, n.deps));
    assert.equal(r.status, 'stopped_reconcile');
    assert.equal(r.attemptRecorded, false);
    assert.equal(f.coordinator.snapshot().attempts, 0);
  });
for (const addresses of [
  [],
  [{ address: '127.0.0.1', family: 4 }],
  [
    { address: '8.8.8.8', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ],
  [{ address: '8.8.8.8', family: 6 }],
])
  test('screens every DNS answer before secret HTTP transport', async () => {
    const f = fixture(),
      n = network(f);
    n.deps.lookup = (_host, _options, cb) => cb(null, addresses);
    const r = safe(await sendGatewayAttempt(f.input, n.deps));
    assert.equal(r.code, 'GW01_GATEWAY_DNS');
    assert.equal(n.calls(), 0);
    assert.equal(f.coordinator.snapshot().attempts, 1);
  });
test('late OS callback after deadline never starts HTTPS and preserves counted unknown', async () => {
  const f = fixture(),
    n = network(f);
  n.deps.timeoutMs = 5;
  n.deps.lookup = (_host, _options, cb) =>
    setTimeout(() => cb(null, [{ address: '8.8.8.8', family: 4 }]), 20);
  const r = safe(await sendGatewayAttempt(f.input, n.deps));
  await new Promise((done) => setTimeout(done, 25));
  assert.equal(r.status, 'stopped_reconcile');
  assert.equal(n.calls(), 0);
  assert.equal(f.coordinator.snapshot().attempts, 1);
});
test('before-send fault is counted unknown without claiming server reachability', async () => {
  const f = fixture('Request'),
    n = network(f);
  f.input.fault = 'before_send_abort';
  const r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.code, 'GW01_GATEWAY_BEFORE_SEND_ABORT');
  assert.equal(n.calls(), 0);
  assert.equal(f.coordinator.snapshot().attempts, 1);
  assert.equal(r.response, null);
});
test('after200headers cancellation never interprets result or retries target; caller must issue fresh status ID', async () => {
  const f = fixture('Request'),
    n = network(f);
  f.input.fault = 'after_headers_cancel';
  const r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.code, 'GW01_GATEWAY_AFTER_HEADERS_CANCELLED');
  assert.equal(r.httpStatus, 200);
  assert.equal(r.response, null);
  assert.equal(r.identityVerified, false);
  assert.equal(r.socketsClosed, true);
  assert.equal(n.calls(), 1);
  assert.equal(f.coordinator.snapshot().attempts, 1);
});
test('authorization denial is separately counted and parsed while secret remains only in fixed headers', async () => {
  const f = fixture('Request'),
    n = network(f, 'denied');
  f.input.kind = 'denial';
  f.input.authorization = 'missing';
  const r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.status, 'complete');
  assert.equal(r.httpStatus, 401);
  assert.equal(r.response.error.code, 'unauthorized');
  assert.equal(n.sent().headers.authorization, undefined);
  assert.equal(f.coordinator.snapshot().attempts, 1);
});
test('persisted two-in-flight and100-attempt caps refuse transport without resetting coordinator', async () => {
  const f = fixture('Request'),
    n = network(f),
    held = [];
  for (let i = 0; i < 2; i++)
    held.push(
      f.coordinator.reserve({
        requestId: randomUUID(),
        operation: 'identity.read',
        audience,
        kind: 'ordinary',
      }),
    );
  let r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.code, 'GW01_PARALLEL_LIMIT');
  assert.equal(n.calls(), 0);
  for (const a of held) f.coordinator.finish(a.attemptId, { outcome: 'unknown', httpStatus: null });
  f.coordinator.close();
  f.input.kind = 'shutdown';
  for (let i = 2; i < 100; i++) {
    const a = f.coordinator.reserve({
      requestId: randomUUID(),
      operation: 'identity.read',
      audience,
      kind: 'shutdown',
    });
    f.coordinator.finish(a.attemptId, { outcome: 'http', httpStatus: 403 });
  }
  r = safe(await sendGatewayAttempt(f.input, n.deps));
  assert.equal(r.code, 'GW01_ATTEMPT_LIMIT');
  assert.equal(n.calls(), 0);
});
test('delayed socket close is awaited after fully parsed body', async () => {
  const f = fixture(),
    n = network(f, 'success', { closeDelayMs: 15 });
  let done = false;
  const pending = sendGatewayAttempt(f.input, n.deps).then((v) => {
    done = true;
    return v;
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false);
  assert.equal((await pending).socketsClosed, true);
});
test('Probe phase preserves verified503 when exact-deployment log capture remains unavailable', async () => {
  const { runGatewayPhase } = await import('./gw01-gateway-transport.mjs');
  const f = fixture(),
    n = network(f);
  const result = await runGatewayPhase(f.input, {
    ...n.deps,
    scanLogs: async (value) => {
      assert.equal(value.requestId, f.input.request.requestId);
      assert.equal(value.protection, protection);
      return { version: 1, status: 'unverified', code: 'GW01_LOGS_NO_CAPTURE' };
    },
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.disabledRouteVerified, true);
  assert.equal(result.identityVerified, false);
  assert.equal(result.logScan.status, 'unverified');
  assert.equal(f.coordinator.snapshot().attempts, 1);
});
test('normal Request never invokes the Probe-only platform log reader', async () => {
  const { runGatewayPhase } = await import('./gw01-gateway-transport.mjs');
  const f = fixture('Request'),
    n = network(f);
  const result = await runGatewayPhase(f.input, {
    ...n.deps,
    scanLogs: () => assert.fail('no platform read'),
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.logScan, null);
});
