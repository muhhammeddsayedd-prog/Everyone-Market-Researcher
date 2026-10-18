import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import {
  shellSpecs,
  buildShell,
  runShellProvision,
  parseLedger,
  memoryJournal,
  verifyShell,
} from './foundation-provision.mjs';

const key = 'SYNTHETIC_TEST_KEY';
const row = (spec, id = 'SyntheticOwned1') => ({
  ...buildShell(spec.key),
  id,
  active: false,
  activeVersionId: null,
  isArchived: false,
  versionId: 'SyntheticVersion1',
  shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
});
const fake = (options = {}) => {
  const rows = options.rows ?? [],
    calls = [];
  let count = 0;
  return {
    calls,
    rows,
    send: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === '/api/v1/projects?limit=100')
        return {
          status: 200,
          body: { data: [{ id: 'pHvQjDmjxVZ3KQLT', type: 'personal' }], nextCursor: null },
        };
      if (path.startsWith('/api/v1/workflows?'))
        return { status: 200, body: { data: rows, nextCursor: options.nextCursor ?? null } };
      if (method === 'POST') {
        if (options.postFailure) throw Error('SYNTHETIC_PRIVATE_ERROR');
        const spec = shellSpecs.find((x) => x.name === body.name),
          r = row(spec, 'SyntheticOwned' + ++count);
        rows.push(r);
        return { status: 200, body: r };
      }
      return { status: 200, body: rows.find((x) => path.endsWith('/' + x.id)) };
    },
  };
};
test('canonical 25 shells have no credential, network node or active trigger', () => {
  assert.deepEqual(Object.fromEntries(shellSpecs.map((x) => [x.key, x.name])), foundationWorkflowNames);
  for (const s of shellSpecs) {
    const b = buildShell(s.key);
    assert.equal(b.projectId, 'pHvQjDmjxVZ3KQLT');
    assert.equal(b.nodes.length, 1);
    assert.equal(b.nodes[0].type, 'n8n-nodes-base.noOp');
    assert.equal(b.settings.callerPolicy, 'none');
    assert.equal(JSON.stringify(b).includes('credentials'), false);
    assert.equal(Object.hasOwn(b, 'active'), false);
  }
});
test('25 POSTs each preceded by durable intent and followed by GET; output only owned sanitized definitions', async () => {
  const api = fake(),
    journal = memoryJournal();
  const r = await runShellProvision(key, journal, api.send);
  assert.equal(r.status, 'shells_verified');
  assert.equal(r.requestCount, 52);
  assert.equal(r.shells.length, 25);
  assert.equal(api.calls.filter((x) => x.method === 'POST').length, 25);
  assert.equal(journal.rows.filter((x) => x.event === 'intent').length, 25);
  assert.equal(journal.rows.filter((x) => x.event === 'verified').length, 25);
  assert.equal(r.finalGraphsBound, false);
  assert.equal(r.gatewayWindowStarted, false);
});
test('ambiguous create persists intent and cannot be blindly repeated', async () => {
  const api = fake({ postFailure: true }),
    journal = memoryJournal();
  const r = await runShellProvision(key, journal, api.send);
  assert.equal(r.status, 'blocked');
  assert.equal(journal.rows.length, 1);
  const api2 = fake();
  const r2 = await runShellProvision(key, journal, api2.send);
  assert.equal(r2.status, 'reconcile_required');
  assert.equal(
    api2.calls.some((x) => x.method === 'POST'),
    false,
  );
});
test('unknown same-name shell is not adopted and shared workflows are not edited', async () => {
  const dto = row(shellSpecs[0]);
  dto.nodes[0].notes = 'not owned';
  const api = fake({ rows: [dto] });
  const r = await runShellProvision(key, memoryJournal(), api.send);
  assert.equal(r.status, 'blocked');
  assert.equal(
    api.calls.some((x) => x.method !== 'GET'),
    false,
  );
});
test('reconcile permits only exact original intent/one owned match, without POST', async () => {
  const journal = memoryJournal([{ event: 'intent', key: shellSpecs[0].key }]),
    api = fake({ rows: [row(shellSpecs[0])] });
  const r = await runShellProvision(key, journal, api.send, { reconcileOnly: true });
  assert.equal(
    api.calls.some((x) => x.method !== 'GET'),
    false,
  );
  assert.equal(r.status, 'reconciliation_complete');
  assert.equal(journal.rows.at(-1).event, 'verified');
});
test('zero/duplicate ambiguous matches stay blocked, even after an earlier timeout', async () => {
  for (const rows of [[], [row(shellSpecs[0]), row(shellSpecs[0], 'OtherOwned')]]) {
    const api = fake({ rows }),
      j = memoryJournal([{ event: 'intent', key: shellSpecs[0].key }]);
    const r = await runShellProvision(key, j, api.send, { reconcileOnly: true });
    assert.equal(r.status, 'blocked');
    assert.equal(
      api.calls.some((x) => x.method === 'POST'),
      false,
    );
  }
});
test('saved shell must remain inactive, same project, exact graph and safe retention', () => {
  for (const mutate of [
    (r) => (r.active = true),
    (r) => (r.activeVersionId = 'Published'),
    (r) => (r.shared[0].projectId = 'other'),
    (r) => (r.nodes[0].parameters = { secret: 'DO_NOT_RETURN' }),
    (r) => (r.settings.saveManualExecutions = true),
  ]) {
    const r = row(shellSpecs[0]);
    mutate(r);
    assert.throws(() => verifyShell(r, shellSpecs[0].key));
  }
});
test('ledger rejects unknown events/keys, acknowledgements before intent and ID swaps', () => {
  for (const rows of [
    [{ event: 'intent', key: 'OTHER' }],
    [{ event: 'oops', key: shellSpecs[0].key }],
    [{ event: 'ack', key: shellSpecs[0].key, id: 'X' }],
    [
      { event: 'intent', key: shellSpecs[0].key },
      { event: 'ack', key: shellSpecs[0].key, id: 'X' },
      { event: 'ack', key: shellSpecs[0].key, id: 'Y' },
    ],
  ])
    assert.throws(() => parseLedger(rows));
});
test('wrong project/metadata response and key reflections stop before another mutation', async () => {
  const api = fake();
  const r = await runShellProvision(key, memoryJournal(), async (method, path, body) =>
    path.startsWith('/api/v1/projects')
      ? { status: 200, body: { data: [{ id: 'pHvQjDmjxVZ3KQLT', type: 'team' }] } }
      : api.send(method, path, body),
  );
  assert.equal(r.status, 'blocked');
  assert.equal(api.calls.length, 0);
  const dto = row(shellSpecs[0], key);
  assert.throws(() => verifyShell(dto, shellSpecs[0].key, key));
});
