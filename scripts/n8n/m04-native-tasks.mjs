// Three owned M04 definitions only. The coordinator supplies the existing
// private transport, durable ledger and encrypted state persistence. No secret
// loading, execution, provider request, schedule or transport lives here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  buildNativeCollector,
  extendNativeCallback,
  withManualCollectorEntry,
} from '../../n8n/collectors/build-native-collectors.mjs';
import {
  foundationRuntimeGraphHash,
  foundationRuntimeExecutionParameterCandidates,
  foundationEditableSettings,
  foundationNativeReadonlySettings,
} from './foundation-runtime-checkpoint.mjs';
import { prepareFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';

const keys = ['WF-10', 'WF-11', 'WF-19'];
const machine = { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' };
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (code = 'RECONCILIATION_REQUIRED') => {
  throw Error('M04_NATIVE_' + code);
};
const body = (dto) => ({
  name: dto.name,
  nodes: structuredClone(dto.nodes),
  connections: structuredClone(dto.connections),
  settings: foundationEditableSettings(dto.settings),
});
const hash = (dto) => foundationRuntimeGraphHash(dto, { editableSettingsOnly: true });
function sameBody(actual, expected) {
  const wanted = hash(expected);
  if (hash(actual) === wanted) return true;
  const variants = foundationRuntimeExecutionParameterCandidates(expected);
  return [variants.nativeDefaults, variants.nativeDefaultsAndSetOutput]
    .filter(Boolean)
    .some((candidate) => hash(actual) === hash(candidate));
}
function workflowMetadata(dto, key, bindings) {
  const ref = bindings.workflowRefs[key];
  if (
    !object(dto) ||
    dto.id !== ref.id ||
    dto.name !== ref.name ||
    dto.isArchived !== false ||
    typeof dto.active !== 'boolean' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(dto.versionId ?? '') ||
    !Array.isArray(dto.shared) ||
    !dto.shared.some((s) => s.projectId === bindings.projectId && s.role === 'workflow:owner') ||
    !Array.isArray(dto.tags) ||
    (dto.pinData != null && (!object(dto.pinData) || Object.keys(dto.pinData).length))
  )
    fail('WORKFLOW_IDENTITY');
  return {
    id: dto.id,
    versionId: dto.versionId,
    active: dto.active,
    activeVersionId: dto.activeVersionId ?? null,
    graphHash: hash(dto),
    readonlySettings: foundationNativeReadonlySettings(dto.settings),
    tags: dto.tags.map(({ id, name }) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}
function credentialMetadata(dto, expected, bindings) {
  if (
    !object(dto) ||
    Object.hasOwn(dto, 'data') ||
    dto.id !== expected.id ||
    dto.name !== expected.name ||
    dto.type !== expected.type ||
    !Number.isFinite(Date.parse(dto.createdAt)) ||
    !Number.isFinite(Date.parse(dto.updatedAt)) ||
    (expected.id === machine.id && dto.createdAt !== '2026-10-19T00:25:21.669Z') ||
    ['isManaged', 'isGlobal', 'isResolvable'].some((k) => dto[k] !== undefined && dto[k] !== false) ||
    (dto.resolverId !== undefined && dto.resolverId !== null) ||
    (dto.projectId !== undefined && dto.projectId !== bindings.projectId) ||
    (Array.isArray(dto.shared) &&
      !dto.shared.some((s) => s.projectId === bindings.projectId && s.role === 'credential:owner'))
  )
    fail('CREDENTIAL_IDENTITY');
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    projectReadback:
      dto.projectId === bindings.projectId || Array.isArray(dto.shared) ? 'verified' : 'not_exposed',
  };
}
function unchanged(actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) fail('DRIFT');
}

/** Mutates only supplied private state. The coordinator durably records each
 * request intent before network activity and encrypts the inventory baseline
 * before mutation phases; pending intent is also set before injected send. */
export async function runNativeTask({ phase, state, send, bindings, repo, machineToken }) {
  const receipt = { phase, status: 'blocked', code: null, requestCount: 0, needsReconciliation: false };
  const n = (state.native ??= {
    snapshots: {},
    current: {},
    staged: {},
    credentials: {},
    machine: { rebound: false },
    pending: null,
    events: [],
  });
  const request = async (method, path, value = null) => {
    receipt.requestCount++;
    const response = await send(method, path, value);
    if (!object(response) || response.status !== 200 || !object(response.body)) fail();
    return response.body;
  };
  const path = (key, suffix = '?excludePinnedData=true') =>
    '/api/v1/workflows/' + bindings.workflowRefs[key].id + suffix;
  const read = async (key) => {
    const dto = await request('GET', path(key));
    return { dto, metadata: workflowMetadata(dto, key, bindings) };
  };
  const checkpoint = (event) => {
    n.events.push({ ...event, observedAt: new Date().toISOString() });
  };
  const completeIntent = () => {
    n.pending = null;
  };
  const changeMachine = async (restore) => {
    if (!n.machine.baseline || !n.machine.current) fail('INVENTORY_REQUIRED');
    const current = credentialMetadata(
      await request('GET', '/api/v1/credentials/' + machine.id),
      machine,
      bindings,
    );
    unchanged(current, n.machine.current);
    const audience = restore ? state.machineBaseline?.audience : state.deployment?.audience;
    const patch = prepareFoundationRuntimeMachinePatch({
      audience,
      restore,
      machineToken,
      ...(restore ? {} : { protectionBypass: state.protectionBypass }),
    });
    n.machine.pending = { action: restore ? 'restore' : 'bind', before: current };
    const saved = credentialMetadata(
      await request('PATCH', '/api/v1/credentials/' + machine.id, patch),
      machine,
      bindings,
    );
    const after = credentialMetadata(
      await request('GET', '/api/v1/credentials/' + machine.id),
      machine,
      bindings,
    );
    unchanged(saved, after);
    if (after.createdAt !== n.machine.baseline.createdAt) fail('CREDENTIAL_IDENTITY');
    n.machine.current = after;
    n.machine.rebound = !restore;
    n.machine.pending = null;
    checkpoint({
      action: restore ? 'machine_restored' : 'machine_bound',
      id: machine.id,
      updatedAt: after.updatedAt,
    });
  };
  const save = async (key, target, action) => {
    const before = await read(key);
    unchanged(before.metadata, n.current[key]);
    if (before.metadata.active || before.metadata.activeVersionId !== null) fail('DRIFT');
    const wire = body(target);
    if (!Object.hasOwn(wire.settings, 'errorWorkflow')) wire.settings.errorWorkflow = 'DEFAULT';
    n.pending = { key, action, before: before.metadata, targetHash: hash(target) };
    const saved = await request('PUT', path(key, '?publishIfActive=false'), wire);
    if (saved.id !== bindings.workflowRefs[key].id || !/^[A-Za-z0-9_-]{1,128}$/.test(saved.versionId ?? ''))
      fail();
    const after = await read(key);
    if (
      after.metadata.versionId !== saved.versionId ||
      after.metadata.active ||
      after.metadata.activeVersionId !== null ||
      !sameBody(after.dto, target) ||
      !isDeepStrictEqual(after.metadata.tags, before.metadata.tags) ||
      !isDeepStrictEqual(after.metadata.readonlySettings, before.metadata.readonlySettings)
    )
      fail();
    n.current[key] = after.metadata;
    completeIntent();
    checkpoint({ action, key, ...after.metadata });
  };
  try {
    if (
      typeof send !== 'function' ||
      bindings.environment !== 'dev' ||
      bindings.projectId !== 'pHvQjDmjxVZ3KQLT' ||
      bindings.instanceUrl !== 'https://muhhammedsayed.app.n8n.cloud' ||
      !Array.isArray(n.events)
    )
      fail('CONFIG');
    if (phase === 'inventory') {
      if (Object.keys(n.snapshots).length || n.pending || n.machine.pending) fail('INVENTORY_EXISTS');
      // Complete the six allocated metadata reads before reporting drift. Full
      // DTOs remain in encrypted coordinator state, never in this receipt.
      for (const key of keys) {
        const dto = await request('GET', path(key));
        n.snapshots[key] = structuredClone(dto);
      }
      for (const [name, expected] of [
        ['machine', machine],
        ['vimeo', bindings.credentials.vimeo],
        ['apify', bindings.credentials.apify],
      ]) {
        const dto = await request('GET', '/api/v1/credentials/' + expected.id);
        n.credentials[name] = credentialMetadata(dto, expected, bindings);
      }
      n.machine.baseline = structuredClone(n.credentials.machine);
      n.machine.current = structuredClone(n.credentials.machine);
      for (const key of keys) {
        const snapshot = n.snapshots[key],
          meta = workflowMetadata(snapshot, key, bindings);
        const reviewed = JSON.parse(readFileSync(join(repo, 'n8n/workflows', key + '.json'), 'utf8'));
        if (
          meta.active ||
          meta.activeVersionId !== null ||
          !sameBody(snapshot, reviewed.workflow) ||
          !isDeepStrictEqual(
            meta.tags,
            reviewed.workflow.tags
              .map(({ id, name }) => ({ id, name }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          )
        )
          fail('DRIFT');
        n.current[key] = meta;
      }
      n.inventoryComplete = true;
      checkpoint({ action: 'inventory_verified', workflowIds: keys.map((key) => n.current[key].id) });
    } else if (phase === 'machine') {
      if (!n.inventoryComplete || n.pending || n.machine.pending || n.machine.rebound)
        fail('RECONCILIATION_REQUIRED');
      await changeMachine(false);
    } else if (phase === 'stage') {
      if (!n.inventoryComplete || n.pending || n.machine.pending || Object.keys(n.staged).length)
        fail('RECONCILIATION_REQUIRED');
      const transport = { audience: state.deployment?.audience, credential: machine };
      for (const [key, kind] of [
        ['WF-10', 'vimeo'],
        ['WF-11', 'instagram'],
      ])
        n.staged[key] = withManualCollectorEntry(
          buildNativeCollector(bindings, transport, kind),
          state.selection?.[kind],
        );
      n.staged['WF-19'] = extendNativeCallback(bindings, transport, {
        key: 'WF-19',
        id: bindings.workflowRefs['WF-19'].id,
        versionId: n.snapshots['WF-19'].versionId,
        workflow: {
          ...body(n.snapshots['WF-19']),
          active: false,
          tags: n.snapshots['WF-19'].tags,
          pinData: {},
        },
      });
      for (const key of keys) await save(key, n.staged[key].workflow, 'staged');
      n.stageComplete = true;
    } else if (phase === 'publish') {
      if (!n.stageComplete || !n.machine.rebound || n.pending || n.machine.pending || n.published) fail();
      const before = await read('WF-19');
      unchanged(before.metadata, n.current['WF-19']);
      if (before.metadata.active || before.metadata.activeVersionId !== null) fail('DRIFT');
      n.pending = { key: 'WF-19', action: 'publish', before: before.metadata };
      await request('POST', path('WF-19', '/publish'), { versionId: before.metadata.versionId });
      const after = await read('WF-19');
      if (
        !after.metadata.active ||
        after.metadata.activeVersionId !== before.metadata.versionId ||
        after.metadata.versionId !== before.metadata.versionId ||
        after.metadata.graphHash !== before.metadata.graphHash ||
        !object(after.dto.activeVersion) ||
        !sameBody(
          { ...after.dto.activeVersion, name: after.dto.name, settings: after.dto.settings },
          n.staged['WF-19'].workflow,
        )
      )
        fail();
      n.current['WF-19'] = after.metadata;
      n.published = true;
      completeIntent();
      checkpoint({ action: 'published', key: 'WF-19', ...after.metadata });
    } else if (phase === 'machine_restore') {
      if (n.machine.pending) fail();
      if (n.machine.rebound) await changeMachine(true);
    } else if (phase === 'restore') {
      try {
        if (!n.inventoryComplete || n.pending || n.machine.pending) fail();
        if (n.published) {
          const before = await read('WF-19');
          unchanged(before.metadata, n.current['WF-19']);
          n.pending = { key: 'WF-19', action: 'unpublish', before: before.metadata };
          await request('POST', path('WF-19', '/unpublish'));
          const after = await read('WF-19');
          if (
            after.metadata.active ||
            after.metadata.activeVersionId !== null ||
            after.metadata.graphHash !== before.metadata.graphHash ||
            after.metadata.versionId !== before.metadata.versionId
          )
            fail();
          n.current['WF-19'] = after.metadata;
          n.published = false;
          completeIntent();
        }
        for (const key of keys) {
          if (n.current[key].graphHash === hash(n.snapshots[key])) {
            const fresh = await read(key);
            unchanged(fresh.metadata, n.current[key]);
            continue;
          }
          await save(key, n.snapshots[key], 'restored');
        }
        n.restoreComplete = true;
      } finally {
        // A conflicting workflow never prevents an independent, already-owned
        // Machine restoration. Unknown Machine mutations remain fenced.
        if (n.machine.rebound && !n.machine.pending) await changeMachine(true);
      }
    } else fail('PHASE');
    receipt.status = 'completed';
  } catch (error) {
    const fixed = new Set(
      [
        'CONFIG',
        'PHASE',
        'WORKFLOW_IDENTITY',
        'CREDENTIAL_IDENTITY',
        'DRIFT',
        'INVENTORY_REQUIRED',
        'INVENTORY_EXISTS',
        'RECONCILIATION_REQUIRED',
      ].map((code) => 'M04_NATIVE_' + code),
    );
    receipt.status = 'blocked';
    receipt.code = fixed.has(error?.message) ? error.message : 'M04_NATIVE_RECONCILIATION_REQUIRED';
    receipt.needsReconciliation = true;
    checkpoint({ action: 'blocked', phase, code: receipt.code });
  }
  receipt.workflows = keys.filter((key) => n.current[key]).map((key) => ({ key, ...n.current[key] }));
  receipt.credentials = Object.values(n.credentials).map(({ id, name, type, projectReadback }) => ({
    id,
    name,
    type,
    projectReadback,
  }));
  receipt.pendingMutation = n.pending !== null || Boolean(n.machine.pending);
  receipt.machineRebound = n.machine.rebound;
  return { public: receipt };
}
