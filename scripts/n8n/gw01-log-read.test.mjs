import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { readLogReadContext, runLogRead } from './gw01-log-read.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
const protection = 'SYNTHETIC_PROTECTION_ONLY_FOR_LOG_READ_0123456789';
const preview = {
  version: 1,
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  branch: 'm03-n8n-foundation',
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_SyntheticOwnedDeployment123',
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  target: 'preview',
  protection: 'all_except_custom_domains',
  routeDisabledVerified: false,
};
const packet = {
  version: 1,
  windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  requestId: '80162039-6088-4011-bdf1-a2a7b5ec11cb',
  attemptId: '66233386-4962-44fe-b499-df973fde25c9',
  reservedAt: 1792313741664,
  finishedAt: 1792313742950,
  httpStatus: 503,
};
function fixture(change = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-log-read-'));
  roots.push(root);
  const config = { windowId: packet.windowId, audiences: [preview.audience] };
  const rows = [
    { seq: 0, type: 'prepared', ...config },
    {
      seq: 1,
      type: 'reserved',
      at: packet.reservedAt,
      attemptId: packet.attemptId,
      requestId: packet.requestId,
      operation: 'identity.read',
      audience: preview.audience,
      kind: 'preflight',
    },
    {
      seq: 2,
      type: 'finished',
      at: packet.finishedAt,
      attemptId: packet.attemptId,
      outcome: 'http',
      httpStatus: 503,
    },
  ];
  const p = structuredClone(packet),
    v = structuredClone(preview);
  change({ rows, packet: p, preview: v, config });
  writeFileSync(join(root, 'gw01-trial.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  return { root, packet: p, preview: v, config, context: () => readLogReadContext(root, p, v, config) };
}
function native(text, code = 0) {
  let calls = 0,
    args;
  return {
    calls: () => calls,
    args: () => args,
    spawn: (_exe, actualArgs, options) => {
      calls++;
      args = actualArgs;
      assert.equal(options.stdio[0], 'ignore');
      assert.equal(options.env.PGPASSWORD, undefined);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.kill = () => {
        queueMicrotask(() => child.emit('close', 1));
      };
      queueMicrotask(() => {
        child.stdout.end(text);
        child.emit('close', code);
      });
      return child;
    },
  };
}
const logRow = (extra = {}) => ({
  deploymentId: preview.deploymentId,
  projectId: preview.projectId,
  domain: new URL(preview.audience).hostname,
  environment: 'preview',
  requestMethod: 'POST',
  requestPath: '/api/internal/n8n/rpc',
  responseStatusCode: 503,
  timestamp: packet.finishedAt,
  ...extra,
});
test('existing successful probe derives only its fixed journal window without journal mutation', () => {
  const f = fixture(),
    before = readFileSync(join(f.root, 'gw01-trial.jsonl'));
  const c = f.context();
  assert.equal(c.since, new Date(packet.reservedAt - 5000).toISOString());
  assert.equal(c.until, new Date(packet.finishedAt + 5000).toISOString());
  assert.deepEqual(readFileSync(join(f.root, 'gw01-trial.jsonl')), before);
});
for (const [name, mutate] of [
  [
    'packet ID',
    ({ packet: p }) => {
      p.requestId = '8'.repeat(36);
    },
  ],
  [
    'packet timestamp',
    ({ packet: p }) => {
      p.finishedAt++;
    },
  ],
  [
    'unknown packet field',
    ({ packet: p }) => {
      p.url = 'https://example.invalid';
    },
  ],
  [
    'missing finish',
    ({ rows }) => {
      rows.pop();
    },
  ],
  [
    'different status',
    ({ rows }) => {
      rows[2].httpStatus = 401;
    },
  ],
  [
    'different operation',
    ({ rows }) => {
      rows[1].operation = 'settings.read';
    },
  ],
  [
    'different audience',
    ({ rows }) => {
      rows[1].audience = 'https://everyone-market-researcher-other.vercel.app';
    },
  ],
  [
    'unknown journal event',
    ({ rows }) => {
      rows.push({ seq: 3, type: 'made_up', at: packet.finishedAt });
    },
  ],
  [
    'enabled preview',
    ({ preview: p }) => {
      p.routeDisabledVerified = true;
    },
  ],
])
  test('rejects ' + name + ' before log invocation', () =>
    assert.throws(() => fixture(mutate).context(), /GW01_LOG_READ_INPUT/),
  );
test('native log GET is invoked once with fixed bounds and no private argv; captured safe503 passes', async () => {
  const f = fixture(),
    n = native(JSON.stringify(logRow()));
  const r = await runLogRead(f.context(), protection, { spawn: n.spawn, cliPath: 'synthetic-cli.js' });
  assert.equal(r.status, 'verified');
  assert.equal(r.gatewayRequests, 0);
  assert.equal(r.logCliInvocations, 1);
  assert.equal(n.calls(), 1);
  assert.equal(n.args().includes(protection), false);
  assert.equal(n.args().includes('--follow'), false);
});
for (const [name, text, code] of [
  ['empty', '', 0],
  ['native failure', JSON.stringify(logRow()), 1],
  ['reflected secret', JSON.stringify(logRow({ nested: protection })), 0],
  [
    'decoded request key',
    JSON.stringify(logRow({ [packet.requestId]: 'public' })).replaceAll(
      packet.requestId,
      [...packet.requestId].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
    ),
    0,
  ],
  ['100-record limit', Array.from({ length: 100 }, () => JSON.stringify(logRow())).join('\n'), 0],
])
  test('log continuation keeps ' + name + ' unverified and never retries', async () => {
    const n = native(text, code);
    const r = await runLogRead(fixture().context(), protection, {
      spawn: n.spawn,
      cliPath: 'synthetic-cli.js',
    });
    assert.equal(r.status, 'unverified');
    assert.equal(n.calls(), 1);
    assert.doesNotMatch(JSON.stringify(r), new RegExp(protection));
  });
test('actual CLI public mode validates local journal and never invokes a log child', () => {
  const f = fixture();
  mkdirSync(join(f.root, 'scripts/n8n/out/gw01'), { recursive: true });
  writeFileSync(
    join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl'),
    readFileSync(join(f.root, 'gw01-trial.jsonl')),
  );
  for (const [name, value] of [
    ['gw01-log-read-packet', f.packet],
    ['gw01-reviewed-preview', f.preview],
    ['gw01-trial-config', f.config],
  ])
    writeFileSync(join(f.root, 'scripts/n8n/' + name + '.json'), JSON.stringify(value));
  const r = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./gw01-log-read.mjs', import.meta.url)), '--check-public'],
    {
      cwd: f.root,
      input: JSON.stringify({ protection: 'GW01_PUBLIC_LOG_READ_PLACEHOLDER_PROTECTION' }),
      encoding: 'utf8',
      env: {},
      timeout: 3000,
    },
  );
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), {
    version: 1,
    status: 'public_ready',
    gatewayRequests: 0,
    logCliInvocations: 0,
    privateRead: false,
  });
});
test('untrusted context is never echoed or allowed to start log CLI', async () => {
  const n = native('');
  const r = await runLogRead({ since: protection }, protection, { spawn: n.spawn });
  assert.equal(r.status, 'unverified');
  assert.equal(n.calls(), 0);
  assert.doesNotMatch(JSON.stringify(r), new RegExp(protection));
});
test('a native log child without close acknowledgement stays explicitly unverified', async () => {
  const spawn = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.kill = () => {};
    return child;
  };
  const r = await runLogRead(fixture().context(), protection, { spawn, timeoutMs: 5, closeTimeoutMs: 5 });
  assert.equal(r.status, 'unverified');
  assert.equal(r.logScan.childClosed, false);
  assert.equal(r.code, 'GW01_LOGS_CLOSE');
});
