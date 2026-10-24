import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { gatewayLogArguments, scanGatewayLogs } from './gw01-gateway-logs.mjs';

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
const protection = 'SYNTHETIC_PRIVATE_PROTECTION_CANARY_0123456789';
const value = {
  preview,
  requestId: '5f517a63-e9df-45cc-8751-9662ecb09c9a',
  since: '2026-10-18T08:00:00.000Z',
  until: '2026-10-18T08:00:30.000Z',
  protection,
};
const row = () => ({
  deploymentId: preview.deploymentId,
  projectId: preview.projectId,
  domain: new URL(preview.audience).hostname,
  environment: 'preview',
  requestMethod: 'POST',
  requestPath: '/api/internal/n8n/rpc',
  responseStatusCode: 503,
  timestamp: Date.parse('2026-10-18T08:00:10Z'),
  logs: [{ message: '{"operation":"rejected","requestId":null,"outcome":"unavailable","status":503}' }],
});
function child(text, options = {}) {
  let spec;
  const spawn = (_exe, args, config) => {
    spec = { args, config };
    const c = new EventEmitter();
    c.stdout = new PassThrough();
    c.stderr = new PassThrough();
    c.kill = () => {
      if (!options.neverClose) setTimeout(() => c.emit('close', 1), 2);
    };
    queueMicrotask(() => {
      if (options.hang) return;
      c.stdout.end(text);
      c.stderr.end(protection);
      setTimeout(() => c.emit('close', options.code ?? 0), 1);
    });
    return c;
  };
  return { spawn, spec: () => spec };
}
test('fixed logs args restrict deployment/project/preview/time/limit without debug or follow', () => {
  const args = gatewayLogArguments(value);
  for (const required of [
    '--deployment',
    preview.deploymentId,
    '--project',
    preview.projectId,
    '--environment',
    'preview',
    '--since',
    value.since,
    '--until',
    value.until,
    '--limit',
    '100',
    '--json',
  ])
    assert.ok(args.includes(required));
  assert.ok(!args.includes('--follow'));
  assert.ok(!args.includes('--debug'));
  assert.ok(!args.includes(protection));
});
test('actual-shaped captured503 request verifies only literal canary absence with metadata withheld', async () => {
  const c = child(JSON.stringify(row()) + '\n'),
    r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
  assert.equal(r.status, 'verified');
  assert.equal(r.capturedMatchingRequest, true);
  assert.equal(r.logsScanned, 1);
  assert.equal(r.childClosed, true);
  assert.equal(r.ownBypassFound, false);
  assert.doesNotMatch(JSON.stringify(r), new RegExp(protection + '|operation|deploymentId'));
  assert.equal(c.spec().config.env.N8N_API_KEY, undefined);
  assert.equal(c.spec().config.env.EMR_WORKER_DB_PASSWORD, undefined);
  assert.equal(c.spec().config.stdio[0], 'ignore');
});
for (const mutation of [
  () => '',
  () => JSON.stringify({ ...row(), deploymentId: 'dpl_Other' }),
  () => JSON.stringify({ ...row(), requestPath: '/other' }),
  () => JSON.stringify({ ...row(), responseStatusCode: 200 }),
  () => JSON.stringify({ ...row(), timestamp: Date.parse('2026-10-18T07:00:00Z') }),
  () => JSON.stringify({ ...row(), messageTruncated: true }),
  () => '{invalid',
])
  test('zero/mismatched/truncated/unparseable logs never prove absence', async () => {
    const c = child(mutation()),
      r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
    assert.equal(r.status, 'unverified');
    assert.equal(r.childClosed, true);
  });
for (const marker of [protection, 'GW01_SYNTHETIC_AUTH_CANARY_ONLY', value.requestId])
  test('privately detected marker is projected only as booleans', async () => {
    const c = child(JSON.stringify({ ...row(), unreviewed: marker })),
      r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
    assert.equal(r.status, 'unverified');
    assert.doesNotMatch(
      JSON.stringify(r),
      new RegExp(protection + '|GW01_SYNTHETIC_AUTH_CANARY_ONLY|' + value.requestId),
    );
    assert.equal(r.ownBypassFound, marker === protection);
    assert.equal(r.publicAuthMarkerFound, marker === 'GW01_SYNTHETIC_AUTH_CANARY_ONLY');
    assert.equal(r.requestBodyMarkerFound, marker === value.requestId);
  });
for (const marker of [protection, 'GW01_SYNTHETIC_AUTH_CANARY_ONLY', value.requestId])
  for (const location of ['key', 'value'])
    test('decoded JSON ' + location + ' marker cannot bypass the private reflection check', async () => {
      const nested = location === 'key' ? { [marker]: 'SYNTHETIC_PUBLIC_VALUE' } : { message: marker };
      const escaped = [...marker].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      const text = JSON.stringify({ ...row(), nested: [nested] }).replaceAll(marker, escaped);
      assert.equal(text.includes(marker), false);
      const c = child(text),
        r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
      assert.equal(r.status, 'unverified');
      assert.equal(r.code, 'GW01_LOGS_REFLECTION');
      assert.equal(r.ownBypassFound, marker === protection);
      assert.equal(r.publicAuthMarkerFound, marker === 'GW01_SYNTHETIC_AUTH_CANARY_ONLY');
      assert.equal(r.requestBodyMarkerFound, marker === value.requestId);
      assert.doesNotMatch(JSON.stringify(r), new RegExp(marker));
    });
test('exactly the 100-record limit cannot establish complete log coverage', async () => {
  const text = Array.from({ length: 100 }, () => JSON.stringify(row())).join('\n');
  const c = child(text),
    r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
  assert.equal(r.logsScanned, 100);
  assert.equal(r.capturedMatchingRequest, true);
  assert.equal(r.truncated, true);
  assert.equal(r.status, 'unverified');
  assert.equal(r.code, 'GW01_LOGS_TRUNCATED');
});
test('native failure discards rawstderr and cannot claim verified logs', async () => {
  const c = child(JSON.stringify(row()), { code: 1 }),
    r = await scanGatewayLogs(value, { spawn: c.spawn, cliPath: 'synthetic-index.js' });
  assert.equal(r.status, 'unverified');
  assert.equal(r.code, 'GW01_LOGS_NATIVE');
  assert.doesNotMatch(JSON.stringify(r), new RegExp(protection));
});
test('bounded CLI timeout kills owned child and awaits actual close', async () => {
  const c = child('', { hang: true }),
    r = await scanGatewayLogs(value, {
      spawn: c.spawn,
      cliPath: 'synthetic-index.js',
      timeoutMs: 5,
      closeTimeoutMs: 10,
    });
  assert.equal(r.status, 'unverified');
  assert.equal(r.code, 'GW01_LOGS_TIMEOUT');
  assert.equal(r.childClosed, true);
});
test('unobserved CLI closure remains unverified', async () => {
  const c = child('', { hang: true, neverClose: true }),
    r = await scanGatewayLogs(value, {
      spawn: c.spawn,
      cliPath: 'synthetic-index.js',
      timeoutMs: 5,
      closeTimeoutMs: 5,
    });
  assert.equal(r.code, 'GW01_LOGS_CLOSE');
  assert.equal(r.childClosed, false);
});
