import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { managementTransport, runOwnedStdinChild } from './gw01-delivery-transport.mjs';

const path = '/api/v1/credentials/EmrGw01Canary18';
const lookup = async () => [{ address: '8.8.8.8', family: 4 }];
const child = () => {
  const c = new EventEmitter();
  c.stdin = new EventEmitter();
  c.stdin.end = () => {};
  return c;
};
test('native child timeout waits for actual close and never resolves on kill alone', async () => {
  const c = child();
  let killed = false;
  c.kill = () => {
    killed = true;
    setTimeout(() => c.emit('close', 1), 15);
  };
  let done = false;
  const p = runOwnedStdinChild(
    { value: 'SYNTHETIC_PRIVATE', env: {} },
    { spawn: () => c, timeoutMs: 5, closeTimeoutMs: 50 },
  ).then((r) => {
    done = true;
    return r;
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(killed, true);
  assert.equal(done, false);
  assert.deepEqual(await p, { ok: false, childClosed: true, code: 'GW01_CHILD_TIMEOUT' });
});
test('unconfirmed owned child close is a bounded cleanup failure', async () => {
  const c = child();
  c.kill = () => {};
  assert.deepEqual(
    await runOwnedStdinChild(
      { value: 'SYNTHETIC_PRIVATE', env: {} },
      { spawn: () => c, timeoutMs: 2, closeTimeoutMs: 4 },
    ),
    { ok: false, childClosed: false, code: 'GW01_CHILD_CLEANUP_UNVERIFIED' },
  );
});
test('post-spawn stdin throw kills and awaits owned child instead of abandoning it', async () => {
  const c = child();
  let kills = 0;
  c.stdin.end = () => {
    throw Error('SYNTHETIC_PRIVATE');
  };
  c.kill = () => {
    kills++;
    setTimeout(() => c.emit('close', 1), 5);
  };
  assert.deepEqual(
    await runOwnedStdinChild(
      { value: 'SYNTHETIC_PRIVATE', env: {} },
      { spawn: () => c, timeoutMs: 30, closeTimeoutMs: 20 },
    ),
    { ok: false, childClosed: true, code: 'GW01_CHILD_START_FAILED' },
  );
  assert.equal(kills, 1);
});
test('post-spawn stdin throw with missing close reports bounded unverified cleanup', async () => {
  const c = child();
  let kills = 0;
  c.stdin.end = () => {
    throw Error('SYNTHETIC_PRIVATE');
  };
  c.kill = () => {
    kills++;
  };
  assert.deepEqual(
    await runOwnedStdinChild(
      { value: 'SYNTHETIC_PRIVATE', env: {} },
      { spawn: () => c, timeoutMs: 30, closeTimeoutMs: 5 },
    ),
    { ok: false, childClosed: false, code: 'GW01_CHILD_CLEANUP_UNVERIFIED' },
  );
  assert.equal(kills, 1);
});
function transport(scenario) {
  let options;
  const fn = managementTransport({
    resolveInstance: lookup,
    timeoutMs: 30,
    closeTimeoutMs: 10,
    request: (o, callback) => {
      options = o;
      const req = new EventEmitter();
      let res;
      req.write = () => {};
      req.destroy = () => {
        queueMicrotask(() => {
          res?.emit('close');
          req.emit('close');
        });
      };
      req.end = () => {
        queueMicrotask(() => {
          if (scenario === 'tls') {
            req.emit('error', Error('SYNTHETIC_PRIVATE'));
            return;
          }
          res = new EventEmitter();
          res.statusCode = 200;
          res.headers = {};
          res.complete = true;
          res.destroy = () => queueMicrotask(() => res.emit('close'));
          if (scenario === 'length') res.headers['content-length'] = '99';
          if (scenario === 'truncated') res.complete = false;
          if (scenario === 'oversize') res.headers['content-length'] = '524289';
          callback(res);
          if (scenario === 'timeout') return;
          res.emit('data', Buffer.from(scenario === 'parse' ? 'invalid' : '{}'));
          res.emit('end');
          res.emit('close');
          req.emit('close');
        });
      };
      return req;
    },
  });
  return { fn, getOptions: () => options };
}
test('management TLS target is fixed and successful receipt waits for complete body plus both closes', async () => {
  const t = transport('ok');
  assert.deepEqual(await t.fn('GET', path, null, 'SYNTHETIC_PRIVATE_KEY'), { status: 200, body: {} });
  const o = t.getOptions();
  assert.equal(o.hostname, 'muhhammedsayed.app.n8n.cloud');
  assert.equal(o.servername, o.hostname);
  assert.equal(o.rejectUnauthorized, true);
  assert.equal(o.agent, false);
  assert.equal(o.path, path);
});
for (const [scenario, code] of [
  ['length', 'BODY'],
  ['truncated', 'BODY'],
  ['oversize', 'BODY'],
  ['parse', 'PARSE'],
  ['tls', 'TLS'],
  ['timeout', 'BODY'],
])
  test(
    'management rejects ' + scenario + ' with finite private-safe stage and closed resources',
    async () => {
      const t = transport(scenario);
      await assert.rejects(
        t.fn('GET', path, null, 'SYNTHETIC_PRIVATE_KEY'),
        new RegExp('^Error: GW01_TRANSPORT_' + code + '$'),
      );
    },
  );
test('DNS failure precedes native request and rejects without exposing resolver details', async () => {
  const fn = managementTransport({
    resolveInstance: async () => {
      throw Error('SYNTHETIC_PRIVATE_DNS');
    },
    request: () => assert.fail('no request'),
  });
  await assert.rejects(fn('GET', path, null, 'SYNTHETIC_PRIVATE_KEY'), /^Error: GW01_TRANSPORT_DNS$/);
});
