import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createTrialCoordinator, GW01_WINDOW_ID } from './gw01-trial.mjs';
import {
  checkShutdownPrerequisites,
  readShutdownPublic,
  runShutdownRead,
  sendPublicShutdown,
  shutdownChildEnvironment,
} from './gw01-shutdown-read.mjs';

const original = {
    audience: 'https://everyone-market-researcher-7k5et630y-muhammed-abdelrahman.vercel.app',
    commitSha: '4d4d13ebf241f12df64de772b0024bf6d5a067e0',
    deploymentId: 'dpl_34mF18oQnjrqS67pdXMBsChLfV7g',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
  },
  current = {
    ...original,
    audience: 'https://everyone-market-researcher-shutdown-synthetic.vercel.app',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_ShutdownSyntheticDeployment123',
  },
  roots = [];
after(() => {
  for (const root of roots) {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    assert.ok(root.includes('emr-gw01-shutdown-synthetic-'));
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture(runtime = true) {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-shutdown-synthetic-'));
  roots.push(root);
  let now = 1792315000000;
  const config = { windowId: GW01_WINDOW_ID, audiences: [original.audience] },
    coordinator = createTrialCoordinator(root, config, () => now);
  coordinator.prepare();
  for (let i = 0; i < 2; i++) {
    const r = coordinator.reserve({
      requestId: randomUUID(),
      operation: 'identity.read',
      audience: original.audience,
      kind: 'preflight',
    });
    coordinator.finish(r.attemptId, { outcome: 'http', httpStatus: 401 });
  }
  if (runtime) {
    coordinator.registerDeployment(current);
    coordinator.start();
    coordinator.bindDatabaseWindow({
      windowId: GW01_WINDOW_ID,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1800000).toISOString(),
    });
  }
  coordinator.close();
  const target = runtime ? current : original,
    preview = {
      version: 1,
      ...target,
      teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
      target: 'preview',
      protection: 'all_except_custom_domains',
      routeDisabledVerified: !runtime,
    },
    packet = {
      version: 1,
      windowId: GW01_WINDOW_ID,
      targets: runtime ? [structuredClone(original), structuredClone(current)] : [structuredClone(original)],
      writerCloseReceipt: {
        version: 1,
        mode: 'Close',
        status: 'complete',
        privateRead: true,
        rootChildClosed: true,
        handoffRetained: true,
        nativeExit: 0,
        result: {
          version: 1,
          status: 'complete',
          mode: 'Close',
          code: null,
          authorizationDenials: 0,
          identity: {
            currentUser: 'n8n_writer',
            sessionUser: 'n8n_writer',
            database: 'postgres',
            projectRef: 'zmotjsbzhzjvpelxvxlf',
          },
          window: {
            id: GW01_WINDOW_ID,
            startsAt: runtime ? new Date(now).toISOString() : null,
            expiresAt: runtime ? new Date(now + 1800000).toISOString() : null,
            closed: true,
            totalAdmitted: runtime ? 1 : 0,
            boundAudience: runtime ? current.audience : null,
            boundCommitSha: runtime ? current.commitSha : null,
            boundDeploymentId: runtime ? current.deploymentId : null,
          },
          connectionClosed: true,
        },
      },
      bypassRevocationReceipt: {
        version: 1,
        mode: 'Revoke',
        status: 'complete',
        code: null,
        nativeExit: 0,
        childClosed: true,
        handoffRetained: false,
        ownEntryPresent: false,
        defaultFlagShape: 'true',
        ownershipMetadataVerified: true,
        createdReceiptRecorded: false,
        recoveredReadbackRecorded: true,
        provenance: 'recovered_sole_readback',
        soleOwnedDefaultVerified: false,
        revocationReadbackVerified: true,
        nonDefaultVerified: false,
        otherEntryCount: 0,
        otherAutomationCount: 0,
        otherSelectedDefaultCount: 0,
        unknownOtherFlagCount: 0,
        otherEntriesRequested: false,
      },
    };
  return {
    root,
    config,
    coordinator,
    packet,
    preview,
    clock: () => now,
    tick: (n) => {
      now += n;
    },
  };
}
function network(scenario = 'success', options = {}) {
  let requests = 0,
    lookupCount = 0,
    sent,
    body;
  const lookup = (host, opts, cb) => {
    lookupCount++;
    assert.ok(host.endsWith('.vercel.app'));
    assert.equal(opts.all, true);
    const done = () => cb(options.dnsError ?? null, options.rows ?? [{ address: '8.8.8.8', family: 4 }]);
    if (options.lookupDelay) setTimeout(done, options.lookupDelay);
    else queueMicrotask(done);
  };
  const request = (opts, onResponse) => {
    requests++;
    sent = opts;
    const req = new EventEmitter(),
      res = new EventEmitter(),
      socket = new EventEmitter();
    let closed = false;
    socket.encrypted = true;
    socket.authorized = scenario !== 'tls';
    const close = () => {
      if (closed || scenario === 'never_close') return;
      closed = true;
      const done = () => {
        res.emit('close');
        req.emit('close');
        socket.emit('close');
      };
      if (options.closeDelay) setTimeout(done, options.closeDelay);
      else queueMicrotask(done);
    };
    req.destroy = () => {
      close();
    };
    res.destroy = () => {
      close();
    };
    req.end = (text) => {
      body = text;
      queueMicrotask(() => {
        req.emit('socket', socket);
        socket.emit('secureConnect');
        if (scenario === 'request_error') {
          req.emit('error', Error('SYNTHETIC_RAW_PRIVATE_MARKER'));
          close();
          return;
        }
        if (scenario === 'timeout') return;
        res.statusCode = options.status ?? 401;
        res.complete = options.complete ?? true;
        res.headers = options.headers ?? {};
        onResponse(res);
        if (scenario === 'aborted') {
          res.emit('aborted');
          close();
          return;
        }
        res.emit('data', Buffer.alloc(scenario === 'oversize' ? 65537 : (options.bodyBytes ?? 10), 65));
        if (scenario !== 'never_close') {
          res.emit('end');
          close();
        }
      });
    };
    return req;
  };
  return {
    lookup,
    request,
    operationMs: options.operationMs ?? 50,
    closeMs: options.closeMs ?? 10,
    calls: () => requests,
    lookups: () => lookupCount,
    sent: () => sent,
    body: () => body,
  };
}

test('prepared abort accepts only the original target with null server and local clock', () => {
  const f = fixture(false);
  assert.equal(
    checkShutdownPrerequisites(f.packet, f.preview, f.coordinator, f.clock).path,
    'prepared_abort',
  );
  assert.equal(f.coordinator.snapshot().attempts, 2);
});
test('normal close requires both exact registered targets and authoritative server clock/binding', () => {
  const f = fixture();
  assert.equal(checkShutdownPrerequisites(f.packet, f.preview, f.coordinator, f.clock).path, 'runtime');
  f.packet.writerCloseReceipt.result.window.boundCommitSha = 'b'.repeat(40);
  assert.throws(
    () => checkShutdownPrerequisites(f.packet, f.preview, f.coordinator, f.clock),
    /GW01_SHUTDOWN_PROOF/,
  );
});
for (const [name, mutate] of [
  [
    'missing server closure',
    (f) => {
      f.packet.writerCloseReceipt.result.window.closed = false;
    },
  ],
  [
    'unclosed writer child',
    (f) => {
      f.packet.writerCloseReceipt.rootChildClosed = false;
    },
  ],
  [
    'wrong actual session identity',
    (f) => {
      f.packet.writerCloseReceipt.result.identity.sessionUser = 'postgres';
    },
  ],
  [
    'missing final empty-map proof',
    (f) => {
      f.packet.bypassRevocationReceipt.revocationReadbackVerified = false;
    },
  ],
  [
    'retained bypass handoff',
    (f) => {
      f.packet.bypassRevocationReceipt.handoffRetained = true;
    },
  ],
  [
    'other bypass entry',
    (f) => {
      f.packet.bypassRevocationReceipt.otherEntryCount = 1;
    },
  ],
  [
    'unknown packet key',
    (f) => {
      f.packet.authorization = 'SYNTHETIC_NO_SECRET';
    },
  ],
  [
    'omitted current target',
    (f) => {
      f.packet.targets.pop();
    },
  ],
  [
    'unregistered target tuple',
    (f) => {
      f.packet.targets[1].deploymentId += 'x';
    },
  ],
  [
    'wrong Preview branch',
    (f) => {
      f.preview.branch = 'main';
    },
  ],
])
  test(name + ' blocks before reservation or DNS', async () => {
    const f = fixture(),
      n = network();
    mutate(f);
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'blocked');
    assert.equal(out.attemptsReserved, 0);
    assert.equal(n.calls(), 0);
    assert.equal(n.lookups(), 0);
    assert.equal(f.coordinator.snapshot().attempts, 2);
  });
test('unknown additional journal deployment cannot be omitted from the target packet', () => {
  const f = fixture();
  f.coordinator.registerDeployment({
    ...current,
    audience: current.audience.replace('synthetic', 'extra'),
    deploymentId: current.deploymentId + 'x',
  });
  assert.throws(
    () => checkShutdownPrerequisites(f.packet, f.preview, f.coordinator, f.clock),
    /GW01_SHUTDOWN_STATE/,
  );
});
test('local open state, expired deadline, exhausted budget and unclosed leases fail closed', async () => {
  for (const scenario of ['open', 'expired', 'budget', 'lease']) {
    const f = fixture();
    if (scenario === 'expired') f.tick(1800000);
    if (scenario === 'budget')
      for (let i = 2; i < 100; i++) {
        const r = f.coordinator.reserve({
          requestId: randomUUID(),
          operation: 'identity.read',
          audience: original.audience,
          kind: 'shutdown',
        });
        f.coordinator.finish(r.attemptId, { outcome: 'http', httpStatus: 401 });
      }
    if (scenario === 'lease')
      f.coordinator.reserve({
        requestId: randomUUID(),
        operation: 'identity.read',
        audience: original.audience,
        kind: 'shutdown',
      });
    const coordinator =
      scenario === 'open'
        ? { ...f.coordinator, snapshot: () => ({ ...f.coordinator.snapshot(), closed: false }) }
        : f.coordinator;
    const n = network(),
      out = await runShutdownRead(f.packet, f.preview, { coordinator, clock: f.clock, ...n });
    assert.equal(out.status, 'blocked', scenario);
    assert.equal(n.calls(), 0, scenario);
  }
});
test('each no-auth POST is durably reserved before DNS and complete 401/403 verifies both targets', async () => {
  const f = fixture(),
    n = network();
  const lookup = (...args) => {
    assert.equal(f.coordinator.snapshot().inFlight, 1);
    return n.lookup(...args);
  };
  const out = await runShutdownRead(f.packet, f.preview, {
    coordinator: f.coordinator,
    clock: f.clock,
    ...n,
    lookup,
  });
  assert.equal(out.status, 'verified');
  assert.equal(out.results.length, 2);
  assert.equal(out.attemptsReserved, 2);
  assert.equal(out.networkRequests, 2);
  assert.equal(out.attemptsAfter, 4);
  assert.deepEqual(f.coordinator.snapshot().verifiedRejectedAudiences, [original.audience, current.audience]);
  assert.equal(f.coordinator.snapshot().inFlight, 0);
  const opts = n.sent();
  assert.equal(opts.method, 'POST');
  assert.equal(opts.path, '/api/internal/n8n/rpc');
  assert.equal(opts.port, 443);
  assert.equal(opts.rejectUnauthorized, true);
  assert.equal(opts.servername, new URL(current.audience).hostname);
  assert.equal(opts.agent, false);
  assert.equal(opts.autoSelectFamily, false);
  assert.deepEqual(Object.keys(opts.headers).sort(), ['accept', 'content-length', 'content-type']);
  const body = JSON.parse(n.body());
  assert.equal(body.operation, 'identity.read');
  assert.deepEqual(body.args, {});
  assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_RAW_PRIVATE_MARKER/);
});
for (const status of [401, 403, 410])
  test('only bounded complete ' + status + ' response proves a public rejection', async () => {
    const f = fixture(false),
      n = network('success', { status });
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'verified');
    assert.equal(out.results[0].httpStatus, status);
    assert.equal(out.results[0].bodyDiscarded, true);
    assert.equal(out.results[0].socketsClosed, true);
  });
for (const status of [200, 307, 503])
  test('HTTP ' + status + ' is recorded without rejection proof or a retry', async () => {
    const f = fixture(),
      n = network('success', { status });
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'unverified');
    assert.equal(out.results.length, 1);
    assert.equal(n.calls(), 1);
    assert.equal(out.results[0].httpStatus, status);
    assert.equal(out.results[0].rejected, false);
    assert.equal(f.coordinator.snapshot().verifiedRejectedAudiences.length, 0);
  });
for (const [label, options] of [
  ['incomplete native message', { complete: false }],
  ['declared longer body', { headers: { 'content-length': '11' } }],
  ['declared shorter body', { headers: { 'content-length': '9' } }],
  ['noncanonical length', { headers: { 'content-length': '010' } }],
  ['duplicate length', { headers: { 'content-length': ['10', '10'] } }],
  ['over-limit declared length', { headers: { 'content-length': '65537' } }],
  ['malformed length', { headers: { 'content-length': 'unknown' } }],
  ['empty length', { headers: { 'content-length': '' } }],
])
  test('complete response proof rejects ' + label + ' despite end and close events', async () => {
    const f = fixture(false),
      n = network('success', options);
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'unverified');
    assert.equal(out.results[0].rejected, false);
    assert.equal(out.results[0].bodyDiscarded, false);
    assert.equal(out.results[0].code, 'GW01_SHUTDOWN_BODY');
    assert.equal(out.results[0].journalFinished, true);
    const last = readFileSync(join(f.root, 'gw01-trial.jsonl'), 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse)
      .at(-1);
    assert.equal(last.outcome, 'unknown');
    assert.equal(last.httpStatus, null);
  });
test('complete response proof accepts bounded matching Content-Length including a zero-byte body', async () => {
  for (const bodyBytes of [0, 10]) {
    const f = fixture(false),
      n = network('success', {
        bodyBytes,
        headers: { 'content-length': String(bodyBytes), 'content-type': 'text/html' },
      });
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'verified');
    assert.equal(out.results[0].bodyDiscarded, true);
  }
});
for (const [name, rows] of [
  ['private', [{ address: '127.0.0.1', family: 4 }]],
  [
    'mixed',
    [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
  ],
  ['family mismatch', [{ address: '8.8.8.8', family: 6 }]],
  ['empty', []],
])
  test(name + ' DNS is reserved but never sent and finishes unknown', async () => {
    const f = fixture(),
      n = network('success', { rows });
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'unverified');
    assert.equal(n.calls(), 0);
    assert.equal(out.attemptsReserved, 1);
    assert.equal(out.results[0].httpStatus, null);
    assert.equal(out.results[0].journalFinished, true);
    assert.equal(f.coordinator.snapshot().inFlight, 0);
  });
test('DNS abort ignores late callbacks and cannot send after the deadline', async () => {
  const f = fixture(),
    n = network('success', { lookupDelay: 25, operationMs: 3 });
  const out = await runShutdownRead(f.packet, f.preview, {
    coordinator: f.coordinator,
    clock: f.clock,
    ...n,
  });
  assert.equal(out.status, 'unverified');
  assert.equal(n.calls(), 0);
  await new Promise((done) => setTimeout(done, 35));
  assert.equal(n.calls(), 0);
});
for (const scenario of ['tls', 'request_error', 'aborted', 'oversize', 'timeout', 'never_close'])
  test(scenario + ' fails without raw output and releases the reservation only as unknown', async () => {
    const f = fixture(),
      n = network(scenario, { operationMs: 5, closeMs: 5 });
    const out = await runShutdownRead(f.packet, f.preview, {
      coordinator: f.coordinator,
      clock: f.clock,
      ...n,
    });
    assert.equal(out.status, 'unverified');
    assert.equal(n.calls(), 1);
    assert.equal(out.results[0].rejected, false);
    assert.equal(out.results[0].journalFinished, true);
    assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_RAW_PRIVATE_MARKER|AAAA/);
    assert.equal(f.coordinator.snapshot().verifiedRejectedAudiences.length, 0);
  });
test('response interpretation waits for delayed owned socket closure', async () => {
  const n = network('success', { closeDelay: 12, closeMs: 40 });
  const started = performance.now(),
    out = await sendPublicShutdown(original, randomUUID(), n);
  assert.equal(out.socketsClosed, true);
  assert.ok(performance.now() - started >= 10);
});
test('already verified targets are read from the journal without repeating successful POSTs', async () => {
  const f = fixture(),
    n = network(),
    before = f.coordinator.snapshot();
  assert.equal(
    (await runShutdownRead(f.packet, f.preview, { coordinator: f.coordinator, clock: f.clock, ...n })).status,
    'verified',
  );
  const calls = n.calls();
  const again = await runShutdownRead(f.packet, f.preview, {
    coordinator: f.coordinator,
    clock: f.clock,
    ...n,
  });
  assert.equal(again.status, 'verified');
  assert.equal(again.attemptsReserved, 0);
  assert.equal(n.calls(), calls);
  assert.equal(f.coordinator.snapshot().startedAt, before.startedAt);
  assert.equal(f.coordinator.snapshot().expiresAt, before.expiresAt);
  assert.equal(f.coordinator.snapshot().attempts, 4);
});
test('shutdown reservations can use the retained final 15 attempts without renewing the window', async () => {
  const f = fixture(false),
    n = network();
  for (let i = 2; i < 99; i++) {
    const r = f.coordinator.reserve({
      requestId: randomUUID(),
      operation: 'identity.read',
      audience: original.audience,
      kind: 'shutdown',
    });
    f.coordinator.finish(r.attemptId, { outcome: 'http', httpStatus: 503 });
  }
  const out = await runShutdownRead(f.packet, f.preview, {
    coordinator: f.coordinator,
    clock: f.clock,
    ...n,
  });
  assert.equal(out.status, 'verified');
  assert.equal(out.attemptsAfter, 100);
  assert.equal(out.attemptsReserved, 1);
  assert.equal(f.coordinator.snapshot().startedAt, null);
});
test('sparse child environment excludes credentials, Node options and proxy/TLS overrides', () => {
  assert.deepEqual(
    shutdownChildEnvironment({
      SystemRoot: 'C:/Windows',
      TEMP: 'C:/Temp',
      PGPASSWORD: 'SYNTHETIC',
      NODE_OPTIONS: '--require=SYNTHETIC',
      NODE_EXTRA_CA_CERTS: 'SYNTHETIC',
      HTTPS_PROXY: 'SYNTHETIC',
      VERCEL_TOKEN: 'SYNTHETIC',
      EMR_WORKER_GATEWAY_TOKEN: 'SYNTHETIC',
    }),
    { SystemRoot: 'C:/Windows', TEMP: 'C:/Temp' },
  );
});
test('an unacknowledged journal finish cannot report verification or start a second request', async () => {
  const f = fixture(),
    n = network(),
    coordinator = {
      ...f.coordinator,
      finish: () => {
        throw Error('SYNTHETIC_RAW_PRIVATE_MARKER');
      },
    };
  const out = await runShutdownRead(f.packet, f.preview, { coordinator, clock: f.clock, ...n });
  assert.equal(out.status, 'unverified');
  assert.equal(out.code, 'GW01_SHUTDOWN_JOURNAL');
  assert.equal(out.results[0].journalFinished, false);
  assert.equal(n.calls(), 1);
  assert.equal(f.coordinator.snapshot().inFlight, 1);
});
function publicFixture() {
  const f = fixture(false),
    repo = join(f.root, 'repo'),
    source = fileURLToPath(new URL('./gw01-shutdown-read.mjs', import.meta.url));
  mkdirSync(join(repo, 'scripts/n8n/out/gw01'), { recursive: true });
  for (const name of ['gw01-shutdown-read.mjs', 'gw01-trial.mjs'])
    writeFileSync(join(repo, 'scripts/n8n', name), readFileSync(join(dirname(source), name)));
  for (const [name, value] of [
    ['gw01-trial-config.json', f.config],
    ['gw01-reviewed-preview.json', f.preview],
    ['gw01-shutdown-packet.json', f.packet],
  ])
    writeFileSync(join(repo, 'scripts/n8n', name), JSON.stringify(value));
  writeFileSync(
    join(repo, 'scripts/n8n/out/gw01/gw01-trial.jsonl'),
    readFileSync(join(f.root, 'gw01-trial.jsonl')),
  );
  const files = Object.fromEntries(
    [
      'gw01-shutdown-read.mjs',
      'gw01-trial.mjs',
      'gw01-trial-config.json',
      'gw01-reviewed-preview.json',
      'gw01-shutdown-packet.json',
    ].map((name) => {
      const path = 'scripts/n8n/' + name;
      return [
        path,
        createHash('sha256')
          .update(readFileSync(join(repo, path)))
          .digest('hex'),
      ];
    }),
  );
  writeFileSync(join(repo, 'scripts/n8n/gw01-shutdown-seal.json'), JSON.stringify({ version: 1, files }));
  return { ...f, repo };
}
test('public seal requires exact fixed inventory and rejects source drift before import', () => {
  const f = publicFixture();
  assert.equal(readShutdownPublic(f.repo).packet.windowId, GW01_WINDOW_ID);
  writeFileSync(join(f.repo, 'scripts/n8n/gw01-trial.mjs'), 'throw Error("SYNTHETIC_NEVER_IMPORT");');
  assert.throws(() => readShutdownPublic(f.repo), /GW01_SHUTDOWN_SEAL/);
});
test('plain Node CheckOnly uses only the existing public closed journal and performs no network or private read', () => {
  const f = publicFixture(),
    before = readFileSync(join(f.repo, 'scripts/n8n/out/gw01/gw01-trial.jsonl'), 'utf8');
  const modulePath = join(f.repo, 'scripts/n8n/gw01-trial.mjs');
  writeFileSync(
    modulePath,
    "if ('EMR_SYNTHETIC_SECRET' in process.env) throw Error('SYNTHETIC_MUST_NOT_REACH_CHILD');\n" +
      readFileSync(modulePath, 'utf8'),
  );
  const sealPath = join(f.repo, 'scripts/n8n/gw01-shutdown-seal.json'),
    seal = JSON.parse(readFileSync(sealPath, 'utf8'));
  seal.files['scripts/n8n/gw01-trial.mjs'] = createHash('sha256')
    .update(readFileSync(modulePath))
    .digest('hex');
  writeFileSync(sealPath, JSON.stringify(seal));
  const owned = spawnSync(
    process.execPath,
    [join(f.repo, 'scripts/n8n/gw01-shutdown-read.mjs'), '--owned-shutdown', 'CheckOnly'],
    { encoding: 'utf8', timeout: 10000, env: shutdownChildEnvironment(process.env) },
  );
  assert.equal(owned.status, 0, owned.stdout);
  const clean = spawnSync(
    process.execPath,
    [join(f.repo, 'scripts/n8n/gw01-shutdown-read.mjs'), 'CheckOnly'],
    {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...shutdownChildEnvironment(process.env),
        EMR_SYNTHETIC_SECRET: 'SYNTHETIC_MUST_NOT_REACH_CHILD',
      },
    },
  );
  assert.equal(clean.status, 0, clean.stdout);
  const out = JSON.parse(clean.stdout);
  assert.equal(out.status, 'check_only_ready');
  assert.equal(out.privateRead, false);
  assert.equal(out.networkRequests, 0);
  assert.equal(out.attemptsReserved, 0);
  assert.equal(out.attemptsAfter, 2);
  assert.equal(out.ownedChildClosed, true);
  assert.equal(readFileSync(join(f.repo, 'scripts/n8n/out/gw01/gw01-trial.jsonl'), 'utf8'), before);
  assert.doesNotMatch(clean.stdout + clean.stderr, /SYNTHETIC_MUST_NOT_REACH_CHILD/);
});
