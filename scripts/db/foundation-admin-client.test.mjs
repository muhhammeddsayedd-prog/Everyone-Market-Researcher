import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { startFoundationAdminClient } from './foundation-admin-client.mjs';
import { verifyFoundationTypes } from './check-foundation-types.mjs';

const epoch = Date.parse('2026-10-21T10:00:00.000Z');
function fixture({ badReady = false, stderr = false, overflow = false, originalDeadlineAtMs } = {}) {
  const calls = [],
    child = new EventEmitter();
  let input = '';
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    queueMicrotask(() => child.emit('close', 1, null));
    return true;
  };
  child.stdin.on('end', () => {
    if (badReady || overflow) queueMicrotask(() => child.emit('close', 1, null));
  });
  const receipt = {
    version: 1,
    runId: 'fixture-run',
    phaseAControl: true,
    childrenClosed: true,
    handoffDeleted: true,
    leaseDeleted: true,
    scratchDeleted: true,
  };
  child.stdin.on('data', (chunk) => {
    input += chunk.toString();
    while (input.includes('\n')) {
      const index = input.indexOf('\n'),
        row = JSON.parse(input.slice(0, index));
      input = input.slice(index + 1);
      calls.push(row);
      if (overflow) {
        child.stdout.write('x'.repeat(1048577));
        child.stdout.write('later-private-data'.repeat(100000));
        continue;
      }
      child.stdout.write(
        JSON.stringify({
          type: 'foundation_admin_result',
          id: row.id,
          kind: row.kind,
          ok: true,
          result: { kind: row.kind },
        }) + '\n',
      );
      if (row.kind === 'end') {
        child.stdout.write(JSON.stringify(receipt) + '\n');
        queueMicrotask(() => child.emit('close', 0, null));
      }
    }
  });
  const deps = {
    spawn(executable, args, options) {
      assert.match(executable, /WindowsPowerShell/);
      assert.ok(args.includes('-PhaseAControl'));
      if (originalDeadlineAtMs !== undefined) {
        assert.equal(args[args.indexOf('-OriginalDeadlineAtMs') + 1], String(originalDeadlineAtMs));
      }
      assert.equal(Object.hasOwn(options.env, 'PGPASSWORD'), false);
      assert.equal(Object.hasOwn(options.env, 'SUPABASE_ACCESS_TOKEN'), false);
      assert.equal(options.windowsHide, true);
      queueMicrotask(() => {
        if (stderr) child.stderr.write('SYNTHETIC_PRIVATE_NATIVE_ERROR');
        child.stdout.write(
          badReady
            ? 'SYNTHETIC_PRIVATE_INVALID_OUTPUT\n'
            : JSON.stringify({
                type: 'foundation_admin_ready',
                runId: 'fixture-run',
                historyAfter: 'complete',
                projectRef: 'zmotjsbzhzjvpelxvxlf',
                hardDeadline: new Date(
                  originalDeadlineAtMs === undefined ? epoch + 4200000 : originalDeadlineAtMs + 600000,
                ).toISOString(),
                actionDeadline: new Date(
                  originalDeadlineAtMs === undefined ? epoch + 3600000 : originalDeadlineAtMs,
                ).toISOString(),
                stopNewAt: new Date(
                  originalDeadlineAtMs === undefined ? epoch + 3000000 : originalDeadlineAtMs - 600000,
                ).toISOString(),
                postchecksVerified: false,
              }) + '\n',
        );
      });
      return child;
    },
  };
  return { calls, deps, child };
}
test('same-child client uses fixed protocol without delivering a password to Node or forwarding parent secrets', async () => {
  const f = fixture({ stderr: true }),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  assert.equal(client.ready.postchecksVerified, false);
  for (const method of [
    'postcheck',
    'preflight',
    'fixture',
    'readUnknown',
    'firstOriginalContext',
    'replaySnapshot',
    'close',
    'archive',
  ])
    await client[method]();
  await client.provision({
    audience: 'https://everyone-market-researcher-fixture.vercel.app',
    commitSha: 'f'.repeat(40),
    deploymentId: 'dpl_Fixture',
  });
  await client.verifyAtomicInput({ atomicInput: {} });
  const query = readFileSync('scripts/db/foundation-settlement.sql', 'utf8').trim();
  await client.readGateway({ query, params: ['df4f29ec-e2dc-4d82-a276-62a4e695e6f9', [], [], '[]'] });
  const done = await client.end();
  assert.equal(done.nativeExit, 0);
  assert.equal(done.childClosed, true);
  assert.deepEqual(f.calls.find((c) => c.kind === 'settlement').args.terminalCosts, []);
  assert.equal(client.state().childClosed, true);
});
test('zero-setup continuation forwards only the fixed original clock and rejects fresh or extended clocks', async () => {
  const deadline = 1792584023481,
    now = () => deadline - 1800000;
  const f = fixture({ originalDeadlineAtMs: deadline });
  const client = await startFoundationAdminClient({ now, originalDeadlineAtMs: deadline }, f.deps);
  assert.equal(Date.parse(client.ready.actionDeadline), deadline);
  assert.equal(Date.parse(client.ready.stopNewAt), deadline - 600000);
  assert.equal(Date.parse(client.ready.hardDeadline), deadline + 600000);
  await client.end();
  for (const value of [deadline + 1, deadline - 1, '1792584023481'])
    await assert.rejects(
      startFoundationAdminClient({ now, originalDeadlineAtMs: value }, fixture().deps),
      /FOUNDATION_ADMIN_BLOCKED/,
    );
  await assert.rejects(
    startFoundationAdminClient(
      { now: () => deadline - 600000, originalDeadlineAtMs: deadline },
      fixture().deps,
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
});
test('foreign SQL and overlapping command requests cannot cross the fixed child protocol', async () => {
  await assert.rejects(
    startFoundationAdminClient({ repositoryRoot: 'C:\\unowned-other-project' }, fixture().deps),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  const f = fixture(),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  await assert.rejects(
    client.readGateway({ query: 'select secret from another_project', params: [] }),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  assert.equal(f.calls.length, 0);
  await client.end();
});
test('malformed private child output becomes only a fixed error and child termination', async () => {
  const f = fixture({ badReady: true });
  await assert.rejects(startFoundationAdminClient({ now: () => epoch }, f.deps), {
    message: 'FOUNDATION_ADMIN_BLOCKED',
  });
});
test('oversized output is permanently discarded while EOF closes the bounded parent', async () => {
  const f = fixture({ overflow: true }),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  await assert.rejects(client.postcheck(), { message: 'FOUNDATION_ADMIN_BLOCKED' });
  assert.equal(client.state().outputDiscarded, true);
  const stopped = await client.abort();
  assert.equal(stopped.childClosed, true);
  assert.equal(stopped.receipt, null);
});
test('actual checked-in type AST verifies all four schemas and quoted property syntax equivalently', () => {
  const reference = readFileSync('packages/shared/src/db.types.ts', 'utf8');
  const candidate = reference.replace(/^(\s*)(app|api|ops|ingest|Tables|Functions|Views):/gm, '$1"$2":');
  assert.equal(verifyFoundationTypes(candidate, reference).astEquivalent, true);
  assert.throws(
    () =>
      verifyFoundationTypes(reference.replace('foundation_gateway_status:', 'another_function:'), reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
  assert.throws(
    () => verifyFoundationTypes('export type Database = {broken:', reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
});
test('fixed settlement SQL remains exactly the source-reviewed native settlement query', () => {
  const canonical = readFileSync('scripts/n8n/foundation-native-settlement.mjs', 'utf8').match(
    /export const foundationSettlementQuery = `([\s\S]+?)`;/,
  )[1];
  assert.equal(readFileSync('scripts/db/foundation-settlement.sql', 'utf8').trim(), canonical.trim());
});
