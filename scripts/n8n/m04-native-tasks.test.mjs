import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runNativeTask } from './m04-native-tasks.mjs';
import { foundationRuntimeGraphHash } from './foundation-runtime-checkpoint.mjs';

const repo = resolve('.');
const bindings = JSON.parse(readFileSync('n8n/foundation/bindings.dev.json', 'utf8'));
const keys = ['WF-10', 'WF-11', 'WF-19'];
const syntheticToken = 'x'.repeat(43);
const ids = (start) =>
  [start, start + 1].map((n) => `${String(n).padStart(8, '0')}-1111-4111-a111-111111111111`);
function fixture() {
  const workflows = Object.fromEntries(
    [...keys, 'SUB-FINISH'].map((key) => {
      const reviewed = JSON.parse(readFileSync(`n8n/workflows/${key}.json`, 'utf8'));
      return [
        reviewed.id,
        {
          ...structuredClone(reviewed.workflow),
          id: reviewed.id,
          versionId: reviewed.versionId,
          activeVersionId: null,
          active: false,
          isArchived: false,
          shared: [{ projectId: bindings.projectId, role: 'workflow:owner' }],
        },
      ];
    }),
  );
  const credentials = Object.fromEntries(
    [
      { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
      bindings.credentials.vimeo,
      bindings.credentials.apify,
    ].map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        type: c.type,
        createdAt: '2026-10-19T00:25:21.669Z',
        updatedAt: '2026-10-26T12:00:00.000Z',
        shared: [{ projectId: bindings.projectId, role: 'credential:owner' }],
      },
    ]),
  );
  const state = {
    sourceHead: 'a'.repeat(40),
    selection: { vimeo: ids(1), instagram: ids(3) },
    deployment: { audience: 'https://everyone-market-researcher-m04-synthetic.vercel.app' },
    machineBaseline: { audience: 'https://everyone-market-researcher-disabled.vercel.app' },
    protectionBypass: 'b'.repeat(32),
  };
  const calls = [];
  let version = 0;
  const send = async (method, path, value) => {
    calls.push({
      method,
      path,
      value: structuredClone(value),
      pendingBeforeSend: structuredClone(state.native?.pending ?? state.native?.machine.pending ?? null),
    });
    const credential = /^\/api\/v1\/credentials\/([A-Za-z0-9_-]+)$/.exec(path);
    if (credential) {
      const dto = credentials[credential[1]];
      if (method === 'PATCH') {
        dto.updatedAt = `2026-10-27T12:00:${String(++version).padStart(2, '0')}.000Z`;
      } else assert.equal(method, 'GET');
      return { status: 200, body: structuredClone(dto) };
    }
    const match =
      /^\/api\/v1\/workflows\/([A-Za-z0-9_-]+)(\?excludePinnedData=true|\?publishIfActive=false|\/publish|\/unpublish)$/.exec(
        path,
      );
    assert.ok(match, 'only exact owned native paths are allowed');
    const dto = workflows[match[1]];
    assert.ok(dto);
    if (method === 'PUT') {
      assert.deepEqual(Object.keys(value).sort(), ['connections', 'name', 'nodes', 'settings']);
      assert.equal(value.settings.errorWorkflow, 'DEFAULT');
      const settings = structuredClone(value.settings);
      delete settings.errorWorkflow;
      Object.assign(dto, structuredClone(value), { settings, versionId: 'm04-version-' + ++version });
    } else if (method === 'POST' && match[2] === '/publish') {
      assert.equal(value.versionId, dto.versionId);
      dto.active = true;
      dto.activeVersionId = dto.versionId;
      dto.activeVersion = { ...structuredClone(dto), workflowId: dto.id };
    } else if (method === 'POST' && match[2] === '/unpublish') {
      dto.active = false;
      dto.activeVersionId = null;
      delete dto.activeVersion;
    } else assert.equal(method, 'GET');
    return { status: 200, body: structuredClone(dto) };
  };
  const run = async (phase, override = send, exportRepo = repo) => {
    const result = await runNativeTask({
      phase,
      state,
      send: override,
      bindings,
      repo: exportRepo,
      machineToken: syntheticToken,
    });
    assert.ok(['completed', 'blocked'].includes(result.public.status));
    if (result.public.status === 'blocked') assert.match(result.public.code, /^M04_NATIVE_[A-Z_]+$/);
    return result;
  };
  return { state, calls, workflows, credentials, send, run };
}

test('three owned definitions and real credential types inventory before inactive staging, one callback publication and exact restoration', async () => {
  const f = fixture();
  const originals = structuredClone(f.workflows);
  for (const phase of ['inventory', 'machine', 'stage', 'publish', 'restore']) {
    const result = await f.run(phase);
    assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
    assert.equal(result.public.needsReconciliation, false);
    assert.ok(!JSON.stringify(result.public).includes(syntheticToken));
    assert.ok(!JSON.stringify(result.public).includes(f.state.protectionBypass));
  }
  assert.equal(f.state.native.restoreComplete, true);
  assert.equal(f.state.native.machine.rebound, false);
  for (const [id, original] of Object.entries(originals)) {
    const restored = f.workflows[id];
    assert.deepEqual(restored.nodes, original.nodes);
    assert.deepEqual(restored.connections, original.connections);
    assert.deepEqual(restored.settings, original.settings);
    assert.equal(restored.active, false);
    assert.equal(restored.activeVersionId, null);
  }
  const writes = f.calls.filter((c) => c.method !== 'GET');
  assert.ok(writes.every((c) => c.pendingBeforeSend !== null));
  assert.equal(writes.filter((c) => c.path.endsWith('/publish')).length, 1);
  assert.ok(
    writes
      .filter((c) => c.path.endsWith('/publish'))
      .every((c) => c.path.includes(bindings.workflowRefs['WF-19'].id)),
  );
  assert.equal(
    f.calls.some((c) => /execute|\/run|actor-runs|acts\//.test(c.path)),
    false,
  );
  const patches = writes.filter((c) => c.method === 'PATCH');
  assert.equal(patches.length, 2);
  assert.equal(patches[0].value.data.allowedDomains, new URL(f.state.deployment.audience).hostname);
  assert.equal(patches[1].value.data.allowedDomains, new URL(f.state.machineBaseline.audience).hostname);
  assert.equal(JSON.parse(patches[1].value.data.json).headers['x-vercel-protection-bypass'], undefined);
});

test('M04 staging disables only the closed foundation dispatch and restores its exact original definition', async () => {
  const f = fixture();
  await f.run('inventory');
  const original = structuredClone(f.state.native.snapshots['WF-19']);
  const result = await f.run('stage');
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  const saved = f.workflows[bindings.workflowRefs['WF-19'].id];
  const name = 'Confirm finish and dispatch stubs';
  for (const before of original.nodes) {
    const after = saved.nodes.find((node) => node.id === before.id);
    assert.deepEqual(after, before.name === name ? { ...before, disabled: true } : before);
  }
  assert.deepEqual(saved.connections[name], original.connections[name]);
  assert.equal((await f.run('restore')).public.status, 'completed');
  assert.deepEqual(f.workflows[original.id].nodes, original.nodes);
  assert.deepEqual(f.workflows[original.id].connections, original.connections);
});

async function legacyRejectedCallback(f) {
  for (const phase of ['inventory', 'machine', 'stage'])
    assert.equal((await f.run(phase)).public.status, 'completed');
  const dto = f.workflows[bindings.workflowRefs['WF-19'].id];
  // Reproduce the already-saved pre-correction graph, not a new Cloud call.
  delete dto.nodes.find((node) => node.name === 'Confirm finish and dispatch stubs').disabled;
  delete f.state.native.staged['WF-19'].workflow.nodes.find(
    (node) => node.name === 'Confirm finish and dispatch stubs',
  ).disabled;
  f.state.native.current['WF-19'].graphHash = foundationRuntimeGraphHash(dto, { editableSettingsOnly: true });
  f.state.native.publishAttemptClosedVersion = dto.versionId;
  f.state.native.published = false;
}

test('known rejected callback correction reads one fixed dependency and saves only WF19 after fresh CAS', async () => {
  const f = fixture();
  await legacyRejectedCallback(f);
  const before = structuredClone(f.workflows),
    start = f.calls.length;
  const result = await f.run('stage');
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.deepEqual(
    f.calls.slice(start).map(({ method }) => method),
    ['GET', 'GET', 'PUT', 'GET'],
  );
  assert.equal(f.calls[start].path, '/api/v1/workflows/RUTwaXMRh3PgLhJq?excludePinnedData=true');
  assert.equal(result.public.foundationDependency.activeVersionId, null);
  assert.equal(result.public.foundationDependency.activationDiagnostic, 'not_exposed_by_workflow_get');
  const callbackId = bindings.workflowRefs['WF-19'].id;
  for (const [id, dto] of Object.entries(before)) {
    if (id !== callbackId) assert.deepEqual(f.workflows[id], dto);
    else {
      assert.deepEqual(f.workflows[id].connections, dto.connections);
      assert.deepEqual(
        f.workflows[id].nodes,
        dto.nodes.map((node) =>
          node.name === 'Confirm finish and dispatch stubs' ? { ...node, disabled: true } : node,
        ),
      );
    }
  }
  assert.equal((await f.run('stage')).public.code, 'M04_NATIVE_RECONCILIATION_REQUIRED');
  assert.equal((await f.run('publish')).public.status, 'completed');
  assert.equal((await f.run('restore')).public.status, 'completed');
});

test('a published dependency refuses the candidate correction before any write', async () => {
  const f = fixture();
  await legacyRejectedCallback(f);
  const dependency = f.workflows[bindings.workflowRefs['SUB-FINISH'].id];
  dependency.active = true;
  dependency.activeVersionId = dependency.versionId;
  const start = f.calls.length,
    result = await f.run('stage');
  assert.equal(result.public.code, 'M04_NATIVE_DEPENDENCY_PUBLISHED');
  assert.equal(f.calls.length - start, 1);
  assert.equal(f.calls[start].method, 'GET');
  assert.equal(f.state.native.pending, null);
});

test('new corrected native readback preserves the earlier saved-version export', async (t) => {
  const f = fixture(),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-readback-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  await legacyRejectedCallback(f);
  assert.equal((await f.run('readback', f.send, output)).public.status, 'completed');
  const firstFile = join(
    output,
    'milestones/M04-collectors-vimeo-instagram/evidence/native-saved-WF-19.json',
  );
  const originalExport = readFileSync(firstFile, 'utf8');
  assert.equal((await f.run('stage')).public.status, 'completed');
  assert.equal((await f.run('publish')).public.status, 'completed');
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  const latest = result.public.exports.find(({ key }) => key === 'WF-19');
  assert.equal(latest.filename, 'native-saved-WF-19.' + f.state.native.current['WF-19'].versionId + '.json');
  assert.equal(readFileSync(firstFile, 'utf8'), originalExport);
  assert.equal(
    JSON.parse(
      readFileSync(
        join(output, 'milestones/M04-collectors-vimeo-instagram/evidence', latest.filename),
        'utf8',
      ),
    ).active,
    true,
  );
});

test('unknown saved definition drift preserves all three snapshots and finishes credential reads before refusing writes', async () => {
  const f = fixture();
  f.workflows[bindings.workflowRefs['WF-10'].id].nodes[1].position = [123, 456];
  const r = await f.run('inventory');
  assert.equal(r.public.code, 'M04_NATIVE_DRIFT');
  assert.equal(f.calls.length, 6);
  assert.equal(Object.keys(f.state.native.snapshots).length, 3);
  assert.equal(Object.keys(f.state.native.credentials).length, 3);
  assert.ok(f.calls.every((c) => c.method === 'GET'));
  assert.equal((await f.run('stage')).public.code, 'M04_NATIVE_RECONCILIATION_REQUIRED');
});

test('actual credential type mismatch is refused without duplication or value projection', async () => {
  const f = fixture();
  f.credentials[bindings.credentials.apify.id].type = 'httpHeaderAuth';
  const r = await f.run('inventory');
  assert.equal(r.public.code, 'M04_NATIVE_CREDENTIAL_IDENTITY');
  assert.ok(f.calls.every((c) => c.method === 'GET'));
});

test('fresh drift blocks before PUT and a lost acknowledged write retains one pending mutation without retry', async () => {
  const f = fixture();
  assert.equal((await f.run('inventory')).public.status, 'completed');
  let puts = 0;
  const r = await f.run('stage', async (method, path, value) => {
    const response = await f.send(method, path, value);
    if (method === 'PUT') {
      puts++;
      throw Error('untrusted credential-bearing native detail');
    }
    return response;
  });
  assert.equal(r.public.code, 'M04_NATIVE_RECONCILIATION_REQUIRED');
  assert.equal(r.public.pendingMutation, true);
  assert.equal(puts, 1);
  assert.equal((await f.run('stage')).public.code, 'M04_NATIVE_RECONCILIATION_REQUIRED');
  assert.equal(puts, 1);
  assert.ok(!JSON.stringify(r.public).includes('untrusted'));
});

test('a fresh pre-save version change is preserved before any native mutation', async () => {
  const f = fixture();
  await f.run('inventory');
  f.workflows[bindings.workflowRefs['WF-10'].id].versionId = 'new-owner-version';
  const r = await f.run('stage');
  assert.equal(r.public.code, 'M04_NATIVE_DRIFT');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  assert.equal(f.workflows[bindings.workflowRefs['WF-10'].id].versionId, 'new-owner-version');
});

test('workflow restoration drift cannot prevent independent known-owned Machine restoration', async () => {
  const f = fixture();
  for (const phase of ['inventory', 'machine', 'stage'])
    assert.equal((await f.run(phase)).public.status, 'completed');
  f.workflows[bindings.workflowRefs['WF-10'].id].versionId = 'unrecognized-newer-version';
  const r = await f.run('restore');
  assert.equal(r.public.code, 'M04_NATIVE_DRIFT');
  assert.equal(f.state.native.machine.rebound, false);
  assert.equal(f.state.native.restoreComplete, undefined);
  assert.equal(f.workflows[bindings.workflowRefs['WF-10'].id].versionId, 'unrecognized-newer-version');
});

test('only the sole owned callback may publish, with native current-version and active graph readback', async () => {
  const f = fixture();
  await f.run('inventory');
  assert.equal((await f.run('publish')).public.code, 'M04_NATIVE_RECONCILIATION_REQUIRED');
  assert.ok(f.calls.every((c) => c.method === 'GET'));
});

test('readback reconciles rejected publication using three GETs, exports actual saved definitions and never retries that version', async (t) => {
  const f = fixture(),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-readback-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const phase of ['inventory', 'machine', 'stage'])
    assert.equal((await f.run(phase)).public.status, 'completed');
  assert.equal(
    (
      await f.run('publish', async (method, path, value) => {
        if (method === 'POST') return { status: 400, body: { message: 'private native diagnostic omitted' } };
        return f.send(method, path, value);
      })
    ).public.status,
    'blocked',
  );
  const start = f.calls.length;
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.equal(result.public.publicationReadback, 'not_active');
  assert.equal(result.public.pendingMutation, false);
  assert.equal(result.public.exports.length, 3);
  assert.equal(f.calls.length - start, 3);
  assert.ok(f.calls.slice(start).every((call) => call.method === 'GET'));
  assert.equal(f.state.native.published, false);
  for (const file of result.public.exports) {
    const record = JSON.parse(
      readFileSync(join(output, 'milestones/M04-collectors-vimeo-instagram/evidence', file.filename), 'utf8'),
    );
    const native = f.workflows[file.id];
    assert.deepEqual(record.workflow.nodes, native.nodes);
    assert.deepEqual(record.workflow.settings, native.settings);
    assert.deepEqual(record.workflow.pinData, {});
    assert.deepEqual(Object.keys(record.workflow).sort(), [
      'connections',
      'name',
      'nodes',
      'pinData',
      'settings',
      'tags',
    ]);
    assert.equal(record.versionId, native.versionId);
    assert.equal(record.sourceHead, f.state.sourceHead);
    assert.ok(!JSON.stringify(record).includes(syntheticToken));
    assert.ok(!JSON.stringify(record).includes(f.state.protectionBypass));
    assert.ok(!JSON.stringify(record).includes('shared'));
  }
  assert.equal((await f.run('publish')).public.code, 'M04_NATIVE_PUBLISH_ATTEMPT_CLOSED');
  assert.equal((await f.run('restore')).public.status, 'completed');
});

test('readback can establish an exactly acknowledged active publication after its response was lost', async (t) => {
  const f = fixture(),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-readback-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const phase of ['inventory', 'machine', 'stage']) await f.run(phase);
  await f.run('publish', async (method, path, value) => {
    const response = await f.send(method, path, value);
    if (method === 'POST') throw Error('lost publication acknowledgment');
    return response;
  });
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.equal(result.public.publicationReadback, 'published');
  assert.equal(result.public.pendingMutation, false);
  assert.equal(f.state.native.published, true);
  assert.equal(result.public.exports.find((e) => e.key === 'WF-19').active, true);
  assert.equal(f.calls.filter((c) => c.path.endsWith('/publish')).length, 1);
});

test('readback preserves pending publication on unknown drift, exports nothing and performs no mutation', async (t) => {
  const f = fixture(),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-readback-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const phase of ['inventory', 'machine', 'stage']) await f.run(phase);
  await f.run('publish', async (method, path, value) =>
    method === 'POST' ? { status: 400, body: {} } : f.send(method, path, value),
  );
  f.workflows[bindings.workflowRefs['WF-19'].id].versionId = 'unknown-owner-version';
  const start = f.calls.length,
    result = await f.run('readback', f.send, output);
  assert.equal(result.public.code, 'M04_NATIVE_DRIFT');
  assert.equal(result.public.pendingMutation, true);
  assert.equal(existsSync(join(output, 'milestones/M04-collectors-vimeo-instagram/evidence')), false);
  assert.ok(f.calls.slice(start).every((call) => call.method === 'GET'));
  assert.equal(f.calls.length - start, 3);
});
