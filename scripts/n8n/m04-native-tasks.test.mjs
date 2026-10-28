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
function fixture({ incremental = false, hc01 = false } = {}) {
  incremental ||= hc01;
  const workflows = Object.fromEntries(
    [...(incremental ? ['WF-00', ...keys] : keys), 'SUB-FINISH'].map((key) => {
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
  if (incremental) {
    state.scope = 'incremental';
    state.approvalId = '123e88b6-5920-4e54-832a-ad6d87c22675';
    state.selection = {
      vimeo: [
        '985a57dd-7934-422d-9d18-4e8ca59fc197',
        '8fefa9a1-3637-43db-843d-97caa9afcc79',
        ...ids(101),
        ids(105)[0],
      ],
      instagram: [...ids(201), ...ids(205), ids(209)[0]],
    };
    state.orchestratorSelection = {
      mode: 'backfill',
      vimeo_account_ids: state.selection.vimeo.slice(2),
      instagram_account_ids: state.selection.instagram,
      max_pages: 2,
      page_size: 20,
      results_limit: 50,
      max_actor_starts: 2,
    };
  }
  if (hc01) {
    state.scope = 'hc01';
    state.approvalId = '1cf8406c-1142-445e-a237-6d0fd7a67b22';
    state.selection = {
      vimeo: ['985a57dd-7934-422d-9d18-4e8ca59fc197'],
      instagram: [
        '962c9c7e-aa0f-46ae-911b-3265859e0577',
        'bed82782-753f-4ba9-91ca-691ef36f75c6',
        '46149fb9-8905-4b76-9834-4b38f668a2e2',
        '2d42d451-ac9a-42ac-a879-8760d63c8108',
        '3ca3befa-abe6-4540-a389-0cf16115c581',
      ],
    };
    const retained = JSON.parse(
      readFileSync('milestones/M04-collectors-vimeo-instagram/evidence/native-saved-WF-90-M04.json', 'utf8'),
    );
    workflows[retained.id] = {
      ...structuredClone(retained.workflow),
      id: retained.id,
      versionId: retained.versionId,
      active: false,
      activeVersionId: null,
      isArchived: false,
      shared: [{ projectId: bindings.projectId, role: 'workflow:owner' }],
    };
  }
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
    if (method === 'POST' && path === '/api/v1/workflows') {
      assert.equal(incremental, true);
      assert.equal(value.projectId, bindings.projectId);
      const dto = {
        ...structuredClone(value),
        id: 'SyntheticM04Error1',
        versionId: 'created-' + ++version,
        active: false,
        activeVersionId: null,
        isArchived: false,
        tags: [],
        shared: [{ projectId: bindings.projectId, role: 'workflow:owner' }],
      };
      delete dto.projectId;
      workflows[dto.id] = dto;
      return { status: 201, body: structuredClone(dto) };
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
      if (value.settings.errorWorkflow !== 'DEFAULT') {
        assert.equal(incremental, true);
        assert.equal(value.settings.errorWorkflow, hc01 ? 'AwxhktgJdvLXE0FZ' : 'SyntheticM04Error1');
        const target = workflows[value.settings.errorWorkflow];
        assert.ok(
          target.activeVersionId,
          'n8n2.43.5 refuses an unpublished changed errorWorkflow at save time',
        );
        assert.ok(
          target.activeVersion.nodes.some((n) => n.type === 'n8n-nodes-base.errorTrigger' && !n.disabled),
        );
      }
      const settings = structuredClone(value.settings);
      if (settings.errorWorkflow === 'DEFAULT') delete settings.errorWorkflow;
      Object.assign(dto, structuredClone(value), { settings, versionId: 'm04-version-' + ++version });
    } else if (method === 'POST' && match[2] === '/publish') {
      assert.equal(value.versionId, dto.versionId);
      dto.active = true;
      dto.activeVersionId = dto.versionId;
      dto.activeVersion = { ...structuredClone(dto), workflowId: dto.id };
    } else if (method === 'POST' && match[2] === '/unpublish') {
      if (dto.id === 'SyntheticM04Error1' || dto.id === 'AwxhktgJdvLXE0FZ')
        assert.ok(
          Object.values(workflows).every((w) => w.settings?.errorWorkflow !== dto.id),
          'consumers must be restored before handler unpublication',
        );
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

test('HC01 reuses the retained handler, stages exact1+4 daily cohorts and restores every original definition', async () => {
  const f = fixture({ hc01: true }),
    originals = structuredClone(f.workflows);
  for (const phase of ['inventory', 'machine', 'stage', 'publish'])
    assert.equal((await f.run(phase)).public.status, 'completed', phase);
  assert.equal(
    f.calls.filter((c) => c.method === 'PUT' && c.path.includes(bindings.workflowRefs['WF-00'].id)).length,
    0,
  );
  assert.equal(f.calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/workflows').length, 0);
  for (const [key, ids, starts] of [
    ['first-instagram', [f.state.selection.instagram[0]], 2],
    ['remaining-instagram', f.state.selection.instagram.slice(1), 8],
  ]) {
    f.state.cohort = { key, account_ids: ids };
    const r = await f.run('cohort');
    assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
    assert.deepEqual(r.public.cohort.input.account_ids, ids);
    assert.equal(r.public.cohort.input.results_limit, 30);
    assert.equal(r.public.cohort.input.max_actor_starts, starts);
  }
  f.state.cohort = { key: 'vimeo-continuation', account_ids: f.state.selection.vimeo };
  const v = await f.run('cohort');
  assert.equal(v.public.status, 'completed');
  assert.equal(v.public.cohort.input.page_size, 5);
  assert.equal(v.public.cohort.input.max_pages, 1);
  assert.equal((await f.run('restore')).public.status, 'completed');
  for (const [id, before] of Object.entries(originals)) {
    assert.deepEqual(f.workflows[id].nodes, before.nodes);
    assert.deepEqual(f.workflows[id].settings, before.settings);
    assert.equal(f.workflows[id].active, false);
  }
  assert.equal(f.state.native.machine.rebound, false);
});

test('HC01 rejects cohort widening and retained-handler drift before mutation', async () => {
  const f = fixture({ hc01: true });
  f.workflows.AwxhktgJdvLXE0FZ.nodes[0].notes = 'unrecognized newer work';
  assert.equal((await f.run('inventory')).public.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  const g = fixture({ hc01: true });
  for (const phase of ['inventory', 'machine', 'stage', 'publish'])
    assert.equal((await g.run(phase)).public.status, 'completed');
  g.state.cohort = {
    key: 'remaining-instagram',
    account_ids: [...g.state.selection.instagram.slice(1, 4), g.state.selection.instagram[0]],
  };
  const before = g.calls.length;
  assert.equal((await g.run('cohort')).public.status, 'blocked');
  assert.equal(g.calls.slice(before).filter((c) => c.method !== 'GET').length, 0);
});

test('HC01 inventory-only restoration performs no workflow mutation and can independently restore a rebound Machine', async () => {
  for (const rebound of [false, true]) {
    const f = fixture({ hc01: true });
    assert.equal((await f.run('inventory')).public.status, 'completed');
    if (rebound) assert.equal((await f.run('machine')).public.status, 'completed');
    const before = f.calls.length;
    const r = await f.run('restore');
    assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
    assert.equal(
      f.calls.slice(before).filter((c) => c.method !== 'GET' && c.path.includes('/workflows/')).length,
      0,
    );
    assert.equal(f.state.native.machine.rebound, false);
  }
});

test('incremental native staging publishes only the newly owned error handler before binding four consumers and reverses that order at shutdown', async () => {
  const f = fixture({ incremental: true }),
    originals = structuredClone(f.workflows);
  for (const phase of ['inventory', 'machine', 'stage', 'publish']) {
    const r = await f.run(phase);
    assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
  }
  const handler = f.state.native.errorHandler;
  assert.equal(handler.id, 'SyntheticM04Error1');
  assert.equal(handler.current.active, true);
  const publishedAt = f.calls.findIndex((c) => c.path === '/api/v1/workflows/SyntheticM04Error1/publish');
  const firstConsumerSave = f.calls.findIndex((c) => c.method === 'PUT');
  assert.ok(publishedAt >= 0 && firstConsumerSave > publishedAt);
  assert.equal(f.state.native.snapshots['WF-00'].id, bindings.workflowRefs['WF-00'].id);
  for (const key of ['WF-00', ...keys]) {
    const actual = f.workflows[bindings.workflowRefs[key].id];
    assert.equal(actual.settings.errorWorkflow, handler.id);
    assert.equal(
      actual.nodes.some((n) => n.type.endsWith('.scheduleTrigger')),
      false,
    );
  }
  assert.ok(
    f.workflows[bindings.workflowRefs['WF-00'].id].nodes.some((n) => n.type.endsWith('.manualTrigger')),
  );
  assert.equal(
    f.workflows[bindings.workflowRefs['WF-19'].id].nodes.some(
      (n) => n.name === 'Confirm finish and dispatch stubs',
    ),
    false,
  );
  assert.equal((await f.run('restore')).public.status, 'completed');
  assert.equal(f.state.native.restoreComplete, true);
  assert.equal(f.workflows[handler.id].active, false);
  assert.equal(f.workflows[handler.id].activeVersionId, null);
  for (const [id, expected] of Object.entries(originals)) {
    assert.deepEqual(f.workflows[id].nodes, expected.nodes);
    assert.deepEqual(f.workflows[id].settings, expected.settings);
  }
  const writes = f.calls.filter((c) => c.method !== 'GET');
  assert.ok(writes.every((c) => c.pendingBeforeSend !== null));
  assert.ok(
    writes.every((c) => c.method !== 'DELETE' && !c.path.includes(bindings.workflowRefs['WF-90'].id)),
  );
  assert.equal(writes.filter((c) => c.path.endsWith('/publish')).length, 2);
  assert.equal(writes.filter((c) => c.path === '/api/v1/workflows').length, 1);
});

test('incremental native staging refuses selection widening and cannot adopt an existing foundation handler', async () => {
  const f = fixture({ incremental: true });
  await f.run('inventory');
  f.state.orchestratorSelection.vimeo_account_ids = f.state.selection.vimeo;
  const r = await f.run('stage');
  assert.equal(r.public.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  const g = fixture({ incremental: true });
  await g.run('inventory');
  g.state.native.errorHandler = { id: bindings.workflowRefs['WF-90'].id };
  const s = await g.run('stage');
  assert.equal(s.public.status, 'blocked');
  assert.equal(g.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('an ambiguous new-handler create is never retried and retains its exact ownership intent', async () => {
  const f = fixture({ incremental: true });
  await f.run('inventory');
  const r = await f.run('stage', async (m, p, v) => {
    const result = await f.send(m, p, v);
    if (m === 'POST' && p === '/api/v1/workflows') throw Error('lost create receipt');
    return result;
  });
  assert.equal(r.public.pendingMutation, true);
  assert.equal(f.state.native.pending.action, 'create');
  assert.equal((await f.run('stage')).public.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.path === '/api/v1/workflows').length, 1);
  assert.equal((await f.run('readback')).public.code, 'M04_NATIVE_CREATE_OUTCOME_UNKNOWN');
});

test('incremental readback reconciles the exact newly owned handler publication after a lost response, without publishing consumers', async (t) => {
  const f = fixture({ incremental: true }),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-incremental-readback-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  await f.run('inventory');
  const r = await f.run('stage', async (m, p, v) => {
    const response = await f.send(m, p, v);
    if (m === 'POST' && p.endsWith('/publish')) throw Error('lost owned handler publication response');
    return response;
  });
  assert.equal(r.public.pendingMutation, true);
  assert.equal(f.state.native.pending.key, 'WF-90-M04');
  const start = f.calls.length;
  const readback = await f.run('readback', f.send, output);
  assert.equal(readback.public.status, 'completed', JSON.stringify(readback.public));
  assert.equal(readback.public.publicationReadback, 'published');
  assert.equal(f.state.native.errorHandler.current.active, true);
  assert.ok(f.calls.slice(start).every((c) => c.method === 'GET'));
  assert.equal((await f.run('stage')).public.status, 'completed');
  assert.equal(f.calls.filter((c) => c.path.endsWith('/publish')).length, 1);
  assert.equal((await f.run('restore')).public.status, 'completed');
});

test('incremental cohort staging uses only exact approved recipes and returns the actual manual target version', async () => {
  const f = fixture({ incremental: true });
  for (const phase of ['inventory', 'machine', 'stage', 'publish'])
    assert.equal((await f.run(phase)).public.status, 'completed');
  for (const [key, account_ids, mode, max_pages, page_size, results_limit] of [
    ['history-pair', f.state.selection.vimeo.slice(0, 2), 'backfill', 2, 5, 5],
    ['cursor', [f.state.selection.vimeo[2]], 'backfill', 2, 20, 5],
    ['daily-vimeo', [f.state.selection.vimeo[0]], 'daily', 1, 20, 20],
    ['daily-instagram', [f.state.selection.instagram[0]], 'daily', 1, 5, 5],
  ]) {
    f.state.cohort = { key, account_ids };
    const start = f.calls.length,
      r = await f.run('cohort');
    assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
    assert.deepEqual(r.public.cohort.input, {
      env: 'dev',
      mode,
      limit: account_ids.length,
      max_pages,
      page_size,
      results_limit,
      max_actor_starts: key === 'daily-vimeo' ? 1 : 2,
      account_ids,
    });
    assert.equal(r.public.cohort.active, false);
    assert.ok(
      f.calls
        .slice(start)
        .filter((c) => c.method !== 'GET')
        .every((c) => c.method === 'PUT' && c.path.includes(r.public.cohort.id)),
    );
  }
  for (const cohort of [
    { key: 'cursor', account_ids: [f.state.selection.vimeo[0]] },
    { key: 'daily-instagram', account_ids: [f.state.selection.vimeo[0]] },
    { key: 'daily-vimeo', account_ids: f.state.selection.vimeo },
    { key: 'history-pair', account_ids: f.state.selection.vimeo.slice(0, 2), max_pages: 50 },
  ]) {
    f.state.cohort = cohort;
    const start = f.calls.length,
      r = await f.run('cohort');
    assert.equal(r.public.status, 'blocked');
    assert.ok(f.calls.slice(start).every((c) => c.method === 'GET'));
  }
  assert.equal((await f.run('restore')).public.status, 'completed');
});

test('incremental restoration preserves drift and leaves the new handler published while any consumer binding remains', async () => {
  const f = fixture({ incremental: true });
  for (const phase of ['inventory', 'machine', 'stage', 'publish']) await f.run(phase);
  f.workflows[bindings.workflowRefs['WF-10'].id].versionId = 'unrelated-owner-version';
  const r = await f.run('restore');
  assert.equal(r.public.code, 'M04_NATIVE_DRIFT');
  assert.equal(f.workflows.SyntheticM04Error1.active, true);
  assert.equal(f.state.native.machine.rebound, false);
  assert.equal(f.state.native.restoreComplete, undefined);
});

test('a rejected owned-handler publication is reconciled read-only and that exact version is not blindly retried', async (t) => {
  const f = fixture({ incremental: true }),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-error-rejected-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  await f.run('inventory');
  await f.run('stage', async (m, p, v) =>
    m === 'POST' && p.endsWith('/publish')
      ? { status: 400, body: { message: 'native error omitted' } }
      : f.send(m, p, v),
  );
  const start = f.calls.length;
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.equal(result.public.publicationReadback, 'not_active');
  assert.ok(f.calls.slice(start).every((c) => c.method === 'GET'));
  assert.equal((await f.run('stage')).public.code, 'M04_NATIVE_PUBLISH_ATTEMPT_CLOSED');
  assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 0);
});

test('a rejected incremental callback publication closes that exact version after read-only reconciliation', async (t) => {
  const f = fixture({ incremental: true }),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-callback-rejected-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const phase of ['inventory', 'machine', 'stage'])
    assert.equal((await f.run(phase)).public.status, 'completed');
  const callbackPublish = '/api/v1/workflows/' + bindings.workflowRefs['WF-19'].id + '/publish';
  let attempts = 0;
  await f.run('publish', async (m, p, v) => {
    if (m === 'POST' && p === callbackPublish) {
      attempts++;
      return { status: 400, body: { message: 'native error omitted' } };
    }
    return f.send(m, p, v);
  });
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.equal(result.public.publicationReadback, 'not_active');
  const start = f.calls.length;
  assert.equal((await f.run('publish')).public.code, 'M04_NATIVE_PUBLISH_ATTEMPT_CLOSED');
  assert.equal(attempts, 1);
  assert.ok(f.calls.slice(start).every((c) => c.method === 'GET'));
  assert.equal((await f.run('restore')).public.status, 'completed');
});

test('a lost create-readback keeps the acknowledged new ID for exact read-only recovery without another POST', async (t) => {
  const f = fixture({ incremental: true }),
    output = mkdtempSync(join(tmpdir(), 'emr-m04-error-created-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  await f.run('inventory');
  await f.run('stage', async (m, p, v) => {
    const result = await f.send(m, p, v);
    if (m === 'GET' && p.includes('SyntheticM04Error1')) throw Error('lost new handler readback');
    return result;
  });
  assert.equal(f.state.native.errorHandler.id, 'SyntheticM04Error1');
  const result = await f.run('readback', f.send, output);
  assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
  assert.equal(f.state.native.errorHandler.current.active, false);
  assert.equal((await f.run('stage')).public.status, 'completed');
  assert.equal(f.calls.filter((c) => c.path === '/api/v1/workflows').length, 1);
});

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
