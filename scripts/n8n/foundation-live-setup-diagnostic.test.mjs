import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import {
  createFoundationSetupProjectDiagnostic,
  projectFoundationSetupPredicates,
} from './foundation-live-setup-diagnostic.mjs';

const project = () => ({
  id: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  accountId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
  rootDirectory: 'apps/web',
  nodeVersion: '24.x',
  framework: 'nextjs',
  link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
  ssoProtection: { deploymentType: 'all_except_custom_domains' },
  protectionBypass: {},
});
function fixture({
  dto = project(),
  status = 200,
  malformed = false,
  nativeExit = 0,
  persistFailure = false,
} = {}) {
  const calls = [],
    rows = [];
  let diagnostic,
    admissions = 0;
  const transport = createFoundationLiveSetupCliTransport(
    {
      nodeExecutable: process.execPath,
      cliPath: resolve('synthetic-cli.js'),
      noRetryPreloadPath: resolve('synthetic-preload.mjs'),
      workingDirectory: resolve('.'),
      now: Date.now,
      deadlineAt: Date.now() + 60000,
      authorizeRequest: (spec) => diagnostic?.authorizeRequest(spec) === true,
    },
    {
      spawn(executable, args, options) {
        calls.push({ executable, args, options });
        const child = new EventEmitter();
        Object.assign(child, {
          stdin: new PassThrough(),
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          kill() {},
        });
        setImmediate(() => {
          child.emit('spawn');
          child.stdout.write(
            'HTTP ' +
              status +
              ' Synthetic\ncontent-type: application/json\n\n' +
              (malformed ? '{' : JSON.stringify(dto)),
          );
          child.emit('close', nativeExit);
        });
        return child;
      },
    },
  );
  diagnostic = createFoundationSetupProjectDiagnostic({
    transport,
    now: Date.now,
    deadlineAt: Date.now() + 60000,
    admitAttempt() {
      admissions++;
    },
    durableAppend(row) {
      if (persistFailure) throw Error('SYNTHETIC_PRIVATE_PERSISTENCE');
      rows.push(row);
    },
  });
  return { diagnostic, transport, calls, rows, admissions: () => admissions };
}
test('fixed GET diagnostic persists intent first, admits once and returns only predicate/transport metadata', async () => {
  const dto = project();
  dto.privateReflection = 'SYNTHETIC_PRIVATE_BODY';
  const f = fixture({ dto });
  const r = await f.diagnostic.run();
  assert.equal(r.status, 'project_contract_ready');
  assert.equal(r.transport.stage, 'completed');
  assert.equal(r.transport.childStarted, true);
  assert.equal(r.transport.childClosed, true);
  assert.equal(r.transport.httpStatus, 200);
  assert.equal(Object.values(r.predicates).every(Boolean), true);
  assert.equal(f.admissions(), 1);
  assert.equal(f.rows[0].event, 'setup_project_diagnostic_intent');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].args.includes('GET'), true);
  assert.equal(f.calls[0].args.includes('--input'), false);
  assert.equal(JSON.stringify(r).includes('SYNTHETIC_PRIVATE_BODY'), false);
  await assert.rejects(f.diagnostic.run(), /FOUNDATION_SETUP_DIAGNOSTIC_BLOCKED/);
  assert.equal(f.calls.length, 1);
  f.diagnostic.close();
});
test('project mismatch and existing bypass yield fixed booleans without exposing credential-bearing keys or values', async () => {
  const dto = project();
  dto.nodeVersion = '22.x';
  dto.protectionBypass = { SYNTHETIC_SECRET_KEY: { value: 'SYNTHETIC_SECRET_VALUE' } };
  const f = fixture({ dto }),
    r = await f.diagnostic.run();
  assert.equal(r.status, 'project_contract_rejected');
  assert.equal(r.predicates.nodeVersion, false);
  assert.equal(r.predicates.bypassEmpty, false);
  assert.equal(JSON.stringify(r).includes('SYNTHETIC_SECRET'), false);
  assert.equal(Object.values(projectFoundationSetupPredicates(null)).every(Boolean), false);
  f.diagnostic.close();
});
for (const [options, expected, stage] of [
  [{ status: 403 }, 'project_http_rejected', 'completed'],
  [{ malformed: true }, 'transport_rejected', 'json'],
  [{ nativeExit: 1 }, 'transport_rejected', 'native_exit'],
])
  test('GET diagnostic separates bounded failure stage: ' + stage, async () => {
    const f = fixture(options),
      r = await f.diagnostic.run();
    assert.equal(r.status, expected);
    assert.equal(r.transport.stage, stage);
    assert.equal(r.transport.childClosed, true);
    assert.equal(r.predicates, null);
    f.diagnostic.close();
  });
test('failed durable intent prevents every child and cannot be retried', async () => {
  const f = fixture({ persistFailure: true });
  await assert.rejects(f.diagnostic.run());
  await assert.rejects(f.diagnostic.run(), /FOUNDATION_SETUP_DIAGNOSTIC_BLOCKED/);
  assert.equal(f.admissions(), 1);
  assert.equal(f.calls.length, 0);
  f.diagnostic.close();
});
