import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import {
  shellSpecs,
  buildShell,
  runShellProvision,
  parseLedger,
  memoryJournal,
  verifyShell,
  restoreOwnedWf00,
  wf00RestoreScope,
  wf00RestoreReadOnlyAttempt,
} from './foundation-provision.mjs';
import * as currentWf00 from './foundation-provision.mjs';

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

const wf00Target = () =>
  JSON.parse(
    readFileSync(new URL('../../n8n/fixtures/WF-00-reviewed-native-staging-025c2a2.json', import.meta.url)),
  );
const wf00BeforeVersion = '00000000-0000-4000-8000-000000000041';
const wf00AfterVersion = '00000000-0000-4000-8000-000000000042';
const wf00BackupRun = '00000000-0000-4000-8000-000000000043';
function restoreFixture(options = {}) {
  const target = wf00Target(),
    journal = {
      rows: structuredClone(options.previousRows ?? []),
      append(value) {
        events.push('journal:' + value.event);
        if (options.appendFault === value.event) throw Error('SYNTHETIC_PRIVATE_JOURNAL');
        if (options.asyncAppend === value.event) return Promise.resolve();
        this.rows.push(structuredClone(value));
      },
    },
    events = [],
    calls = [],
    before = {
      ...structuredClone(target.workflow),
      id: target.id,
      versionId: wf00BeforeVersion,
      active: false,
      activeVersionId: null,
      activeVersion: null,
      isArchived: false,
      shared: [{ projectId: target.projectId, role: 'workflow:owner' }],
    };
  // Model the exact approved forensic category pattern, never actual Cloud data.
  before.nodes[0].parameters = { synthetic: 'SYNTHETIC_PRIVATE_OLD_PARAMETER' };
  before.nodes[0].position = [991, 992];
  before.settings.executionTimeout++;
  options.before?.(before, target);
  options.target?.(target);
  let reads = 0,
    after = structuredClone(before),
    backupCalls = 0;
  const ports = {
    journal,
    async protectBackup(...args) {
      backupCalls++;
      events.push('backup');
      assert.equal(args.length, 1, 'the backup component never receives the management credential');
      assert.deepEqual(args[0], before);
      if (options.backupFault) throw Error('SYNTHETIC_PRIVATE_BACKUP');
      return (
        options.backupResult ?? {
          kind: 'wf00_restore_backup_ready',
          runId: wf00BackupRun,
          backupReady: true,
          childNoCredential: true,
        }
      );
    },
    async send(method, path, body, privateKey) {
      assert.equal(privateKey, key);
      const expectedPath = '/api/v1/workflows/' + wf00RestoreScope.workflowId;
      assert.equal(
        path,
        expectedPath + (method === 'PUT' ? '?publishIfActive=false' : '?excludePinnedData=true'),
      );
      assert.ok(method === 'GET' || method === 'PUT');
      calls.push({ method, path, body: structuredClone(body) });
      events.push(method);
      if (method === 'PUT') {
        assert.equal(backupCalls, 1);
        assert.equal(journal.rows.filter((v) => v.event === 'restore_intent').length, 1);
        assert.ok(events.indexOf('backup') < events.indexOf('journal:backup_ready'));
        assert.ok(events.indexOf('journal:backup_ready') < events.indexOf('journal:restore_intent'));
        assert.ok(events.indexOf('backup') < events.indexOf('journal:restore_intent'));
        assert.ok(events.indexOf('journal:restore_intent') < events.indexOf('PUT'));
        assert.deepEqual(Object.keys(body).sort(), ['connections', 'name', 'nodes', 'settings']);
        assert.equal(Object.hasOwn(body.settings, 'binaryMode'), false);
        assert.deepEqual(body, {
          name: target.workflow.name,
          nodes: target.workflow.nodes,
          connections: target.workflow.connections,
          settings: target.workflow.settings,
        });
        if (!options.skipSave)
          after = {
            ...structuredClone(before),
            ...structuredClone(body),
            settings: { ...structuredClone(before.settings), ...structuredClone(body.settings) },
            versionId: wf00AfterVersion,
          };
        if (options.putFault) throw Error('SYNTHETIC_PRIVATE_PUT');
        return { status: options.putStatus ?? 200, body: {} };
      }
      const index = reads++;
      if (options.readFault === index) throw Error('SYNTHETIC_PRIVATE_READ');
      const value = structuredClone(index === 0 ? before : after);
      if (index > 0) options.after?.(value);
      return { status: options.readStatus ?? 200, body: value };
    },
    ...(options.knownClosedError
      ? { transportDiagnostic: () => ({ httpStatus: 502, transportCode: 'FOUNDATION_TRANSPORT_JSON' }) }
      : {}),
  };
  return {
    target,
    ports,
    calls,
    events,
    journal,
    backupCalls: () => backupCalls,
    run: () => restoreOwnedWf00(key, target, ports),
  };
}
function assertSafeRestore(result, journal) {
  assert.doesNotMatch(
    JSON.stringify(result) + JSON.stringify(journal.rows),
    /SYNTHETIC_PRIVATE|SYNTHETIC_TEST_KEY|"(?:parameters|connections|settings|nodes)":/,
  );
  assert.equal(result.executionCount, 0);
  assert.equal(result.credentialsCreated, 0);
  assert.equal(result.gatewayWindowStarted, false);
}

function currentRestoreFixture(options = {}) {
  const receipt = JSON.parse(
    readFileSync(
      new URL(
        '../../milestones/M03-n8n-foundation/evidence/wf00-current-drift-readback-20261025.json',
        import.meta.url,
      ),
    ),
  );
  const f = restoreFixture({
    ...options,
    before(dto, target) {
      dto.nodes = structuredClone(target.workflow.nodes);
      dto.settings = { ...structuredClone(target.workflow.settings), binaryMode: 'separate' };
      dto.versionId = 'fe249a62-8276-47c1-a58a-7bb50705a280';
      for (const difference of receipt.rawResult.inventory.forensics.nodeDifferences) {
        const node = dto.nodes.find((value) => value.id === difference.nodeId);
        for (const name of difference.missingParameterKeys) delete node.parameters[name];
        for (const name of difference.changedParameterKeys)
          node.parameters[name] = { synthetic: 'SYNTHETIC_PRIVATE_NATIVE_OPTION' };
        if (difference.layoutChanged) node.position[0] += 800;
      }
      options.before?.(dto, target);
    },
  });
  f.ports.currentRestoreContext = currentWf00.qualifyCurrentWf00Restore(receipt);
  return f;
}

test('current pinned WF00 restore uses a fresh journal, exact finite drift and encrypted backup before one PUT', async () => {
  assert.equal(typeof currentWf00.qualifyCurrentWf00Restore, 'function');
  const f = currentRestoreFixture(),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_verified');
  assert.equal(result.requestCount, 3);
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ['GET', 'PUT', 'GET'],
  );
  assert.equal(result.beforeVersionPrivatelyBackedUp, true);
  assert.equal(result.nativeStorageModePreserved, true);
  const again = await f.run();
  assert.equal(again.status, 'wf00_restore_reconciliation_required');
  assert.equal(again.requestCount, 0);
  assertSafeRestore(result, f.journal);
});

test('current WF00 restoration rejects forged context or changed observed version, finite drift, identity and native settings', async () => {
  assert.equal(typeof currentWf00.qualifyCurrentWf00Restore, 'function');
  for (const mutate of [
    (dto) => (dto.versionId = wf00BeforeVersion),
    (dto) => (dto.nodes.find((node) => node.name === 'Config').parameters.assignments = {}),
    (dto) => (dto.nodes[0].name = 'SYNTHETIC_PRIVATE_DIFFERENT_NAME'),
    (dto) => (dto.settings.binaryMode = 'combined'),
    (dto) => (dto.settings.syntheticUnknown = true),
    (dto) => (dto.active = true),
    (dto) => (dto.tags = []),
  ]) {
    const f = currentRestoreFixture({ before: mutate }),
      result = await f.run();
    assert.equal(result.putAttempted, false);
    assert.equal(result.requestCount, 1);
    assert.equal(f.backupCalls(), 0);
    assertSafeRestore(result, f.journal);
  }
  const forged = currentRestoreFixture();
  forged.ports.currentRestoreContext = { ...forged.ports.currentRestoreContext };
  const denied = await forged.run();
  assert.equal(denied.requestCount, 0);
  assert.equal(denied.putAttempted, false);
  const receipt = JSON.parse(
    readFileSync(
      new URL(
        '../../milestones/M03-n8n-foundation/evidence/wf00-current-drift-readback-20261025.json',
        import.meta.url,
      ),
    ),
  );
  for (const mutate of [
    (value) => (value.rawResult.inventory.baseline.failedChecks = []),
    (value) => (value.rawResult.childClosed = false),
    (value) => value.usageAfter.management--,
    (value) => (value.rawResult.inventory.forensics.nodeDifferences[0].missingParameterKeys = []),
  ]) {
    const altered = structuredClone(receipt);
    mutate(altered);
    assert.throws(() => currentWf00.qualifyCurrentWf00Restore(altered));
  }
});

test('approved WF00 restore backs up the fresh DTO before a once-only inactive PUT and exact GET readback', async () => {
  const f = restoreFixture(),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_verified');
  assert.equal(result.requestCount, 3);
  assert.deepEqual(
    f.calls.map((v) => v.method),
    ['GET', 'PUT', 'GET'],
  );
  assert.equal(result.backupReady, true);
  assert.equal(result.beforeVersionPrivatelyBackedUp, true);
  assert.equal(result.writeIntentRecorded, true);
  assert.equal(result.putAcknowledged, true);
  assert.equal(result.exactContentVerified, true);
  assert.equal(result.inactiveVerified, true);
  assert.equal(result.ownerAndTagsVerified, true);
  assert.equal(result.networkCompletionVerified, true);
  assert.equal(result.versionId, wf00AfterVersion);
  assert.equal(f.journal.rows.filter((v) => v.event === 'restore_intent').length, 1);
  assert.equal(f.journal.rows.filter((v) => v.event === 'restore_verified').length, 1);
  assertSafeRestore(result, f.journal);
});

test('WF00 restore denies changed activation, ownership, tags and every unapproved forensic category before backup or PUT', async () => {
  for (const mutate of [
    (v) => (v.active = true),
    (v) => (v.activeVersionId = 'SyntheticPublished'),
    (v) => (v.activeVersion = { versionId: 'SyntheticPublished' }),
    (v) => (v.isArchived = true),
    (v) => (v.id = 'SyntheticForeignWorkflow'),
    (v) => (v.name = 'Synthetic foreign name'),
    (v) => (v.shared[0].projectId = 'SyntheticForeignProject'),
    (v) => (v.shared[0].role = 'workflow:viewer'),
    (v) => v.shared.push({ projectId: 'SyntheticOtherProject', role: 'workflow:owner' }),
    (v) => (v.syntheticPrivateMetadata = key),
    (v) => (v.tags[0].name = 'env:prod'),
    (v) => v.tags.pop(),
    (v) => (v.nodes[0].typeVersion = 999),
    (v) => (v.nodes[0].credentials = { httpHeaderAuth: { id: 'SyntheticForeignCredential' } }),
    (v) => (v.nodes[0].disabled = true),
    (v) => (v.nodes[0].notes = 'Synthetic changed ownership note'),
    (v) => (v.connections = {}),
    (v) => (v.settings.saveManualExecutions = true),
    (v) => (v.settings.availableInMCP = true),
    (v) => (v.settings.errorWorkflow = 'SyntheticForeignErrorHandler'),
    (v, t) => (v.nodes[0].parameters = structuredClone(t.workflow.nodes[0].parameters)),
    (v, t) => (v.nodes[0].position = structuredClone(t.workflow.nodes[0].position)),
    (v) => (v.pinData = { synthetic: [] }),
  ]) {
    const f = restoreFixture({ before: mutate }),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_blocked');
    assert.equal(result.putAttempted, false);
    assert.equal(f.backupCalls(), 0);
    assert.deepEqual(
      f.calls.map((v) => v.method),
      ['GET'],
    );
    assertSafeRestore(result, f.journal);
  }
});

test('WF00 restoration refuses source drift and previously recorded attempts before any new network request', async () => {
  for (const options of [
    { target: (t) => (t.id = 'SyntheticForeign') },
    { target: (t) => (t.versionId = wf00AfterVersion) },
    { target: (t) => (t.projectId = 'SyntheticForeign') },
    { target: (t) => t.workflow.settings.executionTimeout++ },
    { previousRows: [{ event: 'restore_intent' }] },
    { previousRows: [{ event: 'request' }] },
  ]) {
    const f = restoreFixture(options),
      result = await f.run();
    assert.ok(['wf00_restore_blocked', 'wf00_restore_reconciliation_required'].includes(result.status));
    assert.equal(f.calls.length, 0);
    assert.equal(f.backupCalls(), 0);
    assert.equal(result.putAttempted, false);
  }
});

test('WF00 backup, native settings-merge compatibility and durable intent failures prevent the PUT', async () => {
  for (const options of [
    { backupFault: true },
    {
      backupResult: {
        kind: 'wf00_restore_backup_ready',
        runId: wf00BackupRun,
        backupReady: true,
        childNoCredential: false,
      },
    },
    {
      backupResult: {
        kind: 'wf00_restore_backup_ready',
        runId: 'SyntheticNotUuid',
        backupReady: true,
        childNoCredential: true,
      },
    },
    { before: (v) => (v.settings.syntheticUnsupportedSetting = true) },
    { appendFault: 'restore_intent' },
    { asyncAppend: 'restore_intent' },
  ]) {
    const f = restoreFixture(options),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_blocked');
    assert.equal(result.putAttempted, false);
    assert.deepEqual(
      f.calls.map((v) => v.method),
      ['GET'],
    );
    assert.equal(
      f.journal.rows.some((v) => v.event === 'restore_verified'),
      false,
    );
    assertSafeRestore(result, f.journal);
  }
});

test('a physically closed lost WF00 PUT ACK gets one GET reconciliation and never a second PUT', async () => {
  const f = restoreFixture({ putFault: true, knownClosedError: true }),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_reconciled');
  assert.equal(result.putAcknowledged, false);
  assert.equal(result.exactContentVerified, true);
  assert.equal(result.networkCompletionVerified, true);
  assert.deepEqual(
    f.calls.map((v) => v.method),
    ['GET', 'PUT', 'GET'],
  );
  assertSafeRestore(result, f.journal);
  const repeated = await f.run();
  assert.equal(repeated.status, 'wf00_restore_reconciliation_required');
  assert.equal(repeated.requestCount, 0);
  assert.equal(f.calls.filter((v) => v.method === 'PUT').length, 1);
});

test('unknown native closure blocks later WF00 calls and never reports exact readback success', async () => {
  for (const options of [{ readFault: 0 }, { putFault: true }, { readFault: 1 }]) {
    const f = restoreFixture(options),
      result = await f.run();
    assert.equal(result.networkCompletionVerified, false);
    assert.equal(result.exactContentVerified, false);
    assert.equal(result.putAcknowledged, options.readFault === 1);
    assert.equal(f.calls.length, options.readFault === 0 ? 1 : options.putFault ? 2 : 3);
    assert.equal(
      f.journal.rows.some((v) => v.event === 'restore_verified'),
      false,
    );
    assertSafeRestore(result, f.journal);
  }
});

test('WF00 final GET must retain exact target, fresh version and inactive ownership even after a PUT ACK', async () => {
  for (const options of [
    { skipSave: true },
    { after: (v) => (v.active = true) },
    { after: (v) => (v.activeVersionId = 'SyntheticPublished') },
    { after: (v) => (v.activeVersion = { versionId: 'SyntheticPublished' }) },
    { after: (v) => (v.shared[0].projectId = 'SyntheticForeign') },
    { after: (v) => v.shared.push({ projectId: 'SyntheticOtherProject', role: 'workflow:viewer' }) },
    { after: (v) => (v.versionId = key) },
    { after: (v) => v.tags.pop() },
    { after: (v) => (v.nodes[0].parameters.syntheticUnexpectedField = true) },
    { after: (v) => (v.nodes[0].syntheticUnknownNodeField = true) },
    { after: (v) => v.settings.executionTimeout++ },
  ]) {
    const f = restoreFixture(options),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_reconciliation_required');
    assert.equal(result.putAttempted, true);
    assert.equal(result.putAcknowledged, true);
    assert.equal(result.exactContentVerified, false);
    assert.deepEqual(
      f.calls.map((v) => v.method),
      ['GET', 'PUT', 'GET'],
    );
    assert.equal(
      f.journal.rows.some((v) => v.event === 'restore_verified'),
      false,
    );
    assertSafeRestore(result, f.journal);
  }
});

// These are synthetic contract tests of the source-pinned, read-only attempt
// prefix. They do not establish authentication or repeat the recorded Cloud GET.
function readOnlyRestoreFixture(options = {}) {
  const { before, ...rest } = options;
  const f = restoreFixture({
    previousRows: wf00RestoreReadOnlyAttempt.rows,
    ...rest,
    before(dto, target) {
      dto.versionId = wf00RestoreReadOnlyAttempt.beforeVersionId;
      dto.settings.binaryMode = 'separate';
      before?.(dto, target);
    },
  });
  f.ports.readOnlyAttemptVerified = true;
  return f;
}

test('one verified read-only WF00 attempt continues with a fresh backup and preserved cumulative request ordinals', async () => {
  const f = readOnlyRestoreFixture(),
    prefix = structuredClone(f.journal.rows),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_verified');
  assert.equal(result.requestCount, 3, 'the local count excludes the preserved earlier GET');
  assert.equal(result.nativeStorageModePreserved, true);
  assert.equal(Object.hasOwn(result, 'nativeReadonlySettings'), false);
  assert.deepEqual(f.journal.rows.slice(0, 2), prefix);
  assert.deepEqual(f.journal.rows[2], {
    event: 'restore_continuation',
    workflowId: wf00RestoreScope.workflowId,
    priorToolReceipt: '905f06',
    priorRequestCount: 1,
    priorBackupRunId: 'fc0bdea1-f733-4c68-ba8c-f062e83b7919',
  });
  assert.deepEqual(
    f.journal.rows.filter((v) => v.event === 'request').map((v) => [v.number, v.method]),
    [
      [1, 'GET'],
      [2, 'GET'],
      [3, 'PUT'],
      [4, 'GET'],
    ],
  );
  assert.ok(f.events.indexOf('journal:restore_continuation') < f.events.indexOf('GET'));
  assert.deepEqual(
    f.journal.rows.filter((v) => v.event === 'backup_ready').map((v) => v.backupRunId),
    [wf00RestoreReadOnlyAttempt.backupRunId, wf00BackupRun],
  );
  assert.equal(f.journal.rows.filter((v) => v.event === 'restore_intent').length, 1);
  assert.deepEqual(f.journal.rows.at(-1).nativeReadonlySettings, { binaryMode: 'separate' });
  assertSafeRestore(result, f.journal);
  const repeated = await f.run();
  assert.equal(repeated.status, 'wf00_restore_reconciliation_required');
  assert.equal(repeated.requestCount, 0);
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls.filter((v) => v.method === 'PUT').length, 1);
});

test('WF00 continuation refuses absent proof, altered prefixes and every previously started mutation before network', async () => {
  const altered = structuredClone(wf00RestoreReadOnlyAttempt.rows);
  altered[1].backupRunId = wf00BackupRun;
  for (const options of [
    { proof: false },
    { proof: undefined },
    { previousRows: [] },
    { previousRows: [wf00RestoreReadOnlyAttempt.rows[0]] },
    { previousRows: [...wf00RestoreReadOnlyAttempt.rows].reverse() },
    { previousRows: altered },
    { previousRows: [...wf00RestoreReadOnlyAttempt.rows, { event: 'restore_intent' }] },
    { previousRows: [...wf00RestoreReadOnlyAttempt.rows, { event: 'restore_continuation' }] },
    { previousRows: [...wf00RestoreReadOnlyAttempt.rows, { event: 'completion_unverified' }] },
  ]) {
    const f = readOnlyRestoreFixture(options);
    if (Object.hasOwn(options, 'proof')) f.ports.readOnlyAttemptVerified = options.proof;
    const prefix = structuredClone(f.journal.rows),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_reconciliation_required');
    assert.equal(result.requestCount, 0);
    assert.equal(result.putAttempted, false);
    assert.equal(f.calls.length, 0);
    assert.equal(f.backupCalls(), 0);
    assert.deepEqual(f.journal.rows, prefix);
    assertSafeRestore(result, f.journal);
  }
});

test('WF00 read-only continuation preserves unsupported-setting refusal and cannot retry its new marker blindly', async () => {
  const f = readOnlyRestoreFixture({
      before: (v) => (v.settings.syntheticUnsupportedSetting = true),
    }),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_blocked');
  assert.equal(result.diagnostic, 'settings_merge_unsupported');
  assert.equal(result.requestCount, 1);
  assert.equal(result.backupReady, true);
  assert.equal(result.writeIntentRecorded, false);
  assert.equal(result.putAttempted, false);
  assert.equal(result.networkCompletionVerified, true);
  assert.deepEqual(
    f.calls.map((v) => v.method),
    ['GET'],
  );
  assert.deepEqual(
    f.journal.rows.map((v) => v.event),
    ['request', 'backup_ready', 'restore_continuation', 'request', 'backup_ready'],
  );
  assertSafeRestore(result, f.journal);
  const repeated = await f.run();
  assert.equal(repeated.status, 'wf00_restore_reconciliation_required');
  assert.equal(repeated.requestCount, 0);
  assert.equal(f.calls.length, 1);
});

test('WF00 continuation requires a synchronous durable marker and distinct backup before a sole PUT', async () => {
  for (const options of [
    { appendFault: 'restore_continuation' },
    { asyncAppend: 'restore_continuation' },
    {
      backupResult: {
        kind: 'wf00_restore_backup_ready',
        runId: wf00RestoreReadOnlyAttempt.backupRunId,
        backupReady: true,
        childNoCredential: true,
      },
    },
  ]) {
    const f = readOnlyRestoreFixture(options),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_blocked');
    assert.equal(result.putAttempted, false);
    assert.equal(result.requestCount, options.backupResult ? 1 : 0);
    assert.equal(f.calls.length, options.backupResult ? 1 : 0);
    assert.equal(
      f.calls.some((v) => v.method === 'PUT'),
      false,
    );
    assertSafeRestore(result, f.journal);
  }
  const f = readOnlyRestoreFixture({ putFault: true, knownClosedError: true }),
    result = await f.run();
  assert.equal(result.status, 'wf00_restore_reconciled');
  assert.equal(result.requestCount, 3);
  assert.equal(result.putAcknowledged, false);
  assert.equal(result.exactContentVerified, true);
  assert.equal(result.networkCompletionVerified, true);
  assert.deepEqual(
    f.calls.map((v) => v.method),
    ['GET', 'PUT', 'GET'],
  );
  assertSafeRestore(result, f.journal);
});

test('WF00 continuation preserves either known native mode without adopting it into the editable PUT', async () => {
  for (const binaryMode of ['separate', 'combined']) {
    const f = readOnlyRestoreFixture({ before: (v) => (v.settings.binaryMode = binaryMode) }),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_verified');
    assert.equal(result.nativeStorageModePreserved, true);
    const put = f.calls.find((v) => v.method === 'PUT');
    assert.equal(Object.hasOwn(put.body.settings, 'binaryMode'), false);
    assert.deepEqual(put.body.settings, wf00Target().workflow.settings);
    assert.deepEqual(f.journal.rows.at(-1).nativeReadonlySettings, { binaryMode });
    assert.equal(JSON.stringify(result).includes(binaryMode), false);
    assertSafeRestore(result, f.journal);
  }
});

test('WF00 continuation blocks changed source version, native enum, resolver and unknown extras before PUT', async () => {
  for (const mutate of [
    (v) => (v.versionId = wf00BeforeVersion),
    (v) => delete v.settings.binaryMode,
    (v) => (v.settings.binaryMode = ''),
    (v) => (v.settings.binaryMode = 'SYNTHETIC_PRIVATE_MODE'),
    (v) => (v.settings.binaryMode = null),
    (v) => (v.settings.binaryMode = false),
    (v) => (v.settings.credentialResolverId = 'SYNTHETIC_PRIVATE_RESOLVER'),
    (v) => (v.settings.credentialResolverId = ''),
    (v) => (v.settings.syntheticUnknownSetting = true),
  ]) {
    const f = readOnlyRestoreFixture({ before: mutate }),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_blocked');
    assert.equal(result.requestCount, 1);
    assert.equal(result.putAttempted, false);
    assert.equal(result.writeIntentRecorded, false);
    assert.equal(result.nativeStorageModePreserved, false);
    assert.deepEqual(
      f.calls.map((v) => v.method),
      ['GET'],
    );
    assert.equal(
      f.journal.rows.some((v) => v.event === 'restore_intent'),
      false,
    );
    assertSafeRestore(result, f.journal);
  }
});

test('WF00 final readback requires unchanged native mode separately from exact editable settings', async () => {
  for (const mutate of [
    (v) => (v.settings.binaryMode = 'combined'),
    (v) => delete v.settings.binaryMode,
    (v) => (v.settings.binaryMode = 'SYNTHETIC_PRIVATE_MODE'),
    (v) => (v.settings.credentialResolverId = 'SYNTHETIC_PRIVATE_RESOLVER'),
    (v) => (v.settings.syntheticUnknownSetting = true),
    (v) => v.settings.executionTimeout++,
  ]) {
    const f = readOnlyRestoreFixture({ after: mutate }),
      result = await f.run();
    assert.equal(result.status, 'wf00_restore_reconciliation_required');
    assert.equal(result.putAcknowledged, true);
    assert.equal(result.exactContentVerified, false);
    assert.equal(result.nativeStorageModePreserved, false);
    assert.equal(
      f.journal.rows.some((v) => v.event === 'restore_verified'),
      false,
    );
    assert.deepEqual(
      f.calls.map((v) => v.method),
      ['GET', 'PUT', 'GET'],
    );
    assertSafeRestore(result, f.journal);
  }
});
