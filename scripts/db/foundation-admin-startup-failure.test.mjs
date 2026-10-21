import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { startFoundationAdminClient, readFoundationAdminStartupFailure } from './foundation-admin-client.mjs';

const epoch = Date.parse('2026-10-21T10:00:00.000Z');
const privateSentinel = 'SYNTHETIC_PRIVATE_SENTINEL_NEVER_PROJECT';
const preflight =
  'M03_FOUNDATION PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.';

function failedChild({ stdout = '', close = true, exit = 1, error = false, spawned = true } = {}) {
  const child = new EventEmitter();
  if (spawned) child.pid = 92345;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin.on('data', () => {});
  let closes = 0;
  child.stdin.on('end', () => {
    if (close && closes++ === 0) queueMicrotask(() => child.emit('close', exit, null));
  });
  return {
    spawn() {
      queueMicrotask(() => {
        if (spawned) child.emit('spawn');
        child.stderr.write(privateSentinel);
        if (stdout) child.stdout.write(stdout);
        if (error) child.emit('error', Error(privateSentinel));
        if (close && !stdout && !error && closes++ === 0) child.emit('close', exit, null);
      });
      return child;
    },
  };
}
async function capture(deps) {
  try {
    await startFoundationAdminClient({ now: () => epoch }, deps);
    assert.fail('Failed synthetic child became ready');
  } catch (error) {
    assert.equal(error.message, 'FOUNDATION_ADMIN_BLOCKED');
    assert.equal(String(error).includes(privateSentinel), false);
    const projection = readFoundationAdminStartupFailure(error);
    assert.ok(projection);
    assert.equal(Object.isFrozen(projection), true);
    assert.equal(JSON.stringify(projection).includes(privateSentinel), false);
    return projection;
  }
}
test('an exact fixed pre-private child line preserves safe boundary and actual native closure without raw diagnostics', async () => {
  const result = await capture(failedChild({ stdout: preflight + '\r\n' }));
  assert.deepEqual(result, {
    kind: 'foundation_admin_startup_failure',
    stage: 'startup',
    diagnostic: 'preflight_blocked',
    childSpawned: true,
    physicalChildClosed: true,
    nativeExit: 1,
    dpapiRead: 'not_attempted',
    authentication: 'not_attempted',
  });
  assert.equal(readFoundationAdminStartupFailure(Error('FOUNDATION_ADMIN_BLOCKED')), null);
  assert.equal(readFoundationAdminStartupFailure({ ...result }), null);
  assert.equal(readFoundationAdminStartupFailure(null), null);
});

test('fixed handoff failure codes remain distinct and establish no DPAPI/authentication attempt', async () => {
  for (const [line, diagnostic] of [
    ['M03_FOUNDATION HANDOFF_MISSING. No decryption or authentication attempted.', 'handoff_missing'],
    [
      'M03_FOUNDATION HANDOFF_PATH_BLOCKED. No private file read, decryption or authentication attempted.',
      'handoff_path_blocked',
    ],
    [
      'M03_FOUNDATION HANDOFF_LEASE_NOT_READY. Public inputs verified; the unchanged two-hour admin lease does not cover this admission. No private file read, decryption or authentication attempted.',
      'handoff_lease_not_ready',
    ],
  ]) {
    const result = await capture(failedChild({ stdout: line + '\n' }));
    assert.equal(result.diagnostic, diagnostic);
    assert.equal(result.dpapiRead, 'not_attempted');
    assert.equal(result.authentication, 'not_attempted');
  }
});

test('malformed, prefix-only and additional private stdout cannot masquerade as a fixed pre-private receipt', async () => {
  for (const stdout of [
    privateSentinel + '\n',
    preflight + ' ' + privateSentinel + '\n',
    preflight + '\n' + privateSentinel + '\n',
    preflight + '\n' + privateSentinel,
    ' ' + preflight + '\n',
  ]) {
    const result = await capture(failedChild({ stdout }));
    assert.equal(result.diagnostic, 'protocol_rejected');
    assert.equal(result.physicalChildClosed, true);
    assert.equal(result.dpapiRead, 'unknown');
    assert.equal(result.authentication, 'unknown');
  }
});

test('a native child closing before ready retains its real exit including zero without claiming startup success', async () => {
  for (const exit of [0, 17, null]) {
    const result = await capture(failedChild({ exit }));
    assert.equal(result.diagnostic, 'child_closed_before_ready');
    assert.equal(result.childSpawned, true);
    assert.equal(result.physicalChildClosed, true);
    assert.equal(result.nativeExit, exit);
    assert.equal(result.dpapiRead, 'unknown');
  }
});

test('a synchronous spawn failure is fixed, branded and cannot expose native error contents', async () => {
  const result = await capture({
    spawn() {
      throw Error(privateSentinel);
    },
  });
  assert.equal(result.diagnostic, 'spawn_failed');
  assert.equal(result.childSpawned, false);
  assert.equal(result.physicalChildClosed, true);
  assert.equal(result.nativeExit, null);
  assert.equal(result.authentication, 'unknown');
});

test('an asynchronous native spawn failure reports no process and no fabricated native exit', async () => {
  const result = await capture(failedChild({ error: true, spawned: false, exit: -2 }));
  assert.equal(result.diagnostic, 'spawn_failed');
  assert.equal(result.childSpawned, false);
  assert.equal(result.physicalChildClosed, true);
  assert.equal(result.nativeExit, null);
  assert.equal(result.dpapiRead, 'unknown');
});

test('an unclosed failed startup remains physically unclosed after the unchanged bounded closure wait', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const failed = capture(failedChild({ stdout: preflight + '\n', close: false }));
  await setImmediate();
  t.mock.timers.tick(250000);
  const result = await failed;
  assert.equal(result.diagnostic, 'preflight_blocked');
  assert.equal(result.childSpawned, true);
  assert.equal(result.physicalChildClosed, false);
  assert.equal(result.nativeExit, null);
  assert.equal(result.dpapiRead, 'not_attempted');
});
