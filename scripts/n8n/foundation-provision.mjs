import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const foundationScope = Object.freeze({
  version: 1,
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  host: 'muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowNameFilter: '[dev]',
  maxRequests: 53,
  maxCreates: 25,
  maxListPages: 2,
});
export const wf00RestoreScope = Object.freeze({
  workflowId: 'MzimjpsuyPuK7SKe',
  sourceCommitSha: '025c2a2c0127566df71cef77797db277f1565568',
  sourceFileSha256: '905e40aa96bea9291961f8e73297a8668b76ead397c834dbc7dc796e14ecfea9',
  reviewedVersionId: 'b2ff9a94-89b8-4fe2-9bed-093774f0feff',
  maximumRequests: 3,
});
export const wf00RestoreReadOnlyAttempt = Object.freeze({
  receiptFile: 'milestones/M03-n8n-foundation/evidence/wf00-restore-attempt-20261023.json',
  receiptSha256: 'e5d6188f80281a0603209b57de131f4f8fe16278c7d56a53ae3f56b77156a3f7',
  journalPrefixSha256: '22c18ac86b7e0e03762cf19ad98a33560344af664fcf25f0a45673906fdc955d',
  toolReceipt: '905f06',
  backupRunId: 'fc0bdea1-f733-4c68-ba8c-f062e83b7919',
  beforeVersionId: '44f1f9ef-a3f0-4a91-b621-13970a3a5f7d',
  rows: Object.freeze([
    Object.freeze({
      event: 'request',
      number: 1,
      method: 'GET',
      path: '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
    }),
    Object.freeze({
      event: 'backup_ready',
      workflowId: 'MzimjpsuyPuK7SKe',
      backupRunId: 'fc0bdea1-f733-4c68-ba8c-f062e83b7919',
    }),
  ]),
});

// A fixed owner-approved restoration, independent of the acceptance clock.
// Native save has no supported optimistic-version field. The encrypted full
// fresh DTO precedes the once intent; subsequent content is never adopted.
export async function restoreOwnedWf00(privateKey, target, ports) {
  const r = {
    version: 1,
    windowId: foundationScope.windowId,
    host: foundationScope.host,
    projectId: foundationScope.projectId,
    workflowId: wf00RestoreScope.workflowId,
    status: 'wf00_restore_blocked',
    requestCount: 0,
    backupReady: false,
    writeIntentRecorded: false,
    putAttempted: false,
    putAcknowledged: false,
    exactContentVerified: false,
    inactiveVerified: false,
    ownerAndTagsVerified: false,
    versionId: null,
    beforeVersionPrivatelyBackedUp: false,
    nativeStorageModePreserved: false,
    executionCount: 0,
    credentialsCreated: 0,
    gatewayWindowStarted: false,
    networkCompletionVerified: true,
    diagnostic: 'source_blocked',
  };
  let stage = 'source_blocked';
  try {
    if (
      typeof privateKey !== 'string' ||
      !privateKey ||
      privateKey.length > 4096 ||
      /[^\x21-\x7e]/.test(privateKey) ||
      !ports ||
      typeof ports.send !== 'function' ||
      typeof ports.protectBackup !== 'function' ||
      !ports.journal ||
      !Array.isArray(ports.journal.rows) ||
      typeof ports.journal.append !== 'function'
    )
      fail();
    const continuingReadOnly =
      ports.readOnlyAttemptVerified === true &&
      isDeepStrictEqual(ports.journal.rows, wf00RestoreReadOnlyAttempt.rows);
    if ((ports.journal.rows.length || ports.readOnlyAttemptVerified === true) && !continuingReadOnly) {
      r.diagnostic = 'intent_recorded';
      r.status = 'wf00_restore_reconciliation_required';
      return r;
    }
    const { graphBody, projectSavedGraph } = await import('./foundation-bind.mjs');
    const {
      diagnoseFoundationRuntimeBaseline,
      diagnoseFoundationRuntimeBaselineVariants,
      foundationNativeReadonlySettings,
      foundationEditableSettings,
    } = await import('./foundation-runtime-checkpoint.mjs');
    const { foundationTransportDiagnostic } = await import('./foundation-management-transport.mjs');
    if (
      target?.key !== 'WF-00' ||
      target.id !== wf00RestoreScope.workflowId ||
      target.versionId !== wf00RestoreScope.reviewedVersionId ||
      target.active !== false ||
      target.activeVersionId !== null ||
      target.projectId !== foundationScope.projectId ||
      target.definitionProfile !== 'inactive_native_staging'
    )
      fail();
    const graph = { key: 'WF-00', workflow: { ...target.workflow, active: false } },
      body = graphBody(graph);
    if (
      createHash('sha256').update(JSON.stringify(body)).digest('hex') !==
      '1090db04ecf847c64c28a8bcb247e1080b1db85d37503c1108aa99f307d21239'
    )
      fail();
    const baseline = {
      key: 'WF-00',
      id: target.id,
      versionId: target.versionId,
      tags: target.workflow.tags,
      body,
    };
    const path = '/api/v1/workflows/' + wf00RestoreScope.workflowId;
    const append = (row) => {
      const value = ports.journal.append(row);
      if (value !== undefined) {
        if (value?.then) Promise.resolve(value).catch(() => {});
        fail();
      }
    };
    if (continuingReadOnly) {
      stage = 'intent_recorded';
      append({
        event: 'restore_continuation',
        workflowId: wf00RestoreScope.workflowId,
        priorToolReceipt: wf00RestoreReadOnlyAttempt.toolReceipt,
        priorRequestCount: 1,
        priorBackupRunId: wf00RestoreReadOnlyAttempt.backupRunId,
      });
    }
    const request = async (method, data = null) => {
      if (r.requestCount >= 3) fail();
      append({
        event: 'request',
        number: r.requestCount + 1 + (continuingReadOnly ? 1 : 0),
        method,
        path: path + (method === 'PUT' ? '?publishIfActive=false' : '?excludePinnedData=true'),
      });
      r.requestCount++;
      try {
        return await ports.send(
          method,
          path + (method === 'PUT' ? '?publishIfActive=false' : '?excludePinnedData=true'),
          data,
          privateKey,
        );
      } catch (error) {
        const d = (ports.transportDiagnostic ?? foundationTransportDiagnostic)(error);
        if (!d || d.transportCode === 'unclassified' || d.transportCode === 'FOUNDATION_TRANSPORT_CLOSE')
          r.networkCompletionVerified = false;
        throw error;
      }
    };
    stage = 'transport_failed';
    const first = await request('GET');
    if (first?.status !== 200 || !object(first.body)) fail();
    const dto = first.body;
    stage = 'drift_blocked';
    if (
      (dto.activeVersion !== undefined && dto.activeVersion !== null) ||
      !Array.isArray(dto.shared) ||
      dto.shared.length !== 1 ||
      dto.shared[0]?.projectId !== foundationScope.projectId ||
      dto.shared[0]?.role !== 'workflow:owner'
    )
      fail();
    if (JSON.stringify(dto).includes(privateKey)) fail();
    if (continuingReadOnly && dto.versionId !== wf00RestoreReadOnlyAttempt.beforeVersionId) fail();
    const before = diagnoseFoundationRuntimeBaseline(dto, baseline, foundationScope.projectId);
    const expectedFailures = ['version_mismatch', 'graph_nodes', 'graph_settings'];
    const forensic = diagnoseFoundationRuntimeBaselineVariants(dto, baseline);
    if (
      !equal(before.failedChecks, expectedFailures) ||
      !equal(before.components, {
        nameEqual: true,
        nodesEqual: false,
        connectionsEqual: true,
        settingsEqual: false,
      }) ||
      !forensic ||
      !equal(forensic.nodeCategories, {
        identityEqual: true,
        parametersEqual: false,
        credentialsEqual: true,
        behaviorEqual: true,
        layoutEqual: false,
        annotationsEqual: true,
      }) ||
      !equal(forensic.settingsCategories, {
        retentionEqual: true,
        mcpVisibilityEqual: true,
        errorRoutingEqual: true,
        otherEqual: false,
      }) ||
      Object.keys(forensic.knownVariants).length !== 9 ||
      Object.values(forensic.knownVariants).some((x) => x !== false)
    )
      fail();
    if (Object.hasOwn(dto.settings, 'credentialResolverId')) fail();
    const nativeBefore = foundationNativeReadonlySettings(dto.settings);
    if (continuingReadOnly && nativeBefore.binaryMode === null) fail();
    stage = 'backup_blocked';
    const backup = await ports.protectBackup(dto);
    if (
      !exact(backup, ['kind', 'runId', 'backupReady', 'childNoCredential']) ||
      backup.kind !== 'wf00_restore_backup_ready' ||
      backup.backupReady !== true ||
      backup.childNoCredential !== true ||
      typeof backup.runId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(backup.runId) ||
      (continuingReadOnly && backup.runId === wf00RestoreReadOnlyAttempt.backupRunId)
    )
      fail();
    r.backupReady = true;
    r.beforeVersionPrivatelyBackedUp = true;
    append({ event: 'backup_ready', workflowId: wf00RestoreScope.workflowId, backupRunId: backup.runId });
    // n8n2.43.5 shallow-merges settings, then removes these documented
    // native defaults. An omitted extra key is not a reset. Never issue a
    // doomed save or adopt the received unknown value to make parity pass.
    const predicted = { ...dto.settings, ...body.settings };
    for (const name of [
      'errorWorkflow',
      'timezone',
      'saveDataErrorExecution',
      'saveDataSuccessExecution',
      'saveManualExecutions',
      'saveExecutionProgress',
    ]) {
      if (predicted[name] === 'DEFAULT') delete predicted[name];
    }
    stage = 'settings_merge_unsupported';
    if (!isDeepStrictEqual(foundationEditableSettings(predicted), body.settings)) fail();
    stage = 'intent_recorded';
    append({
      event: 'restore_intent',
      workflowId: wf00RestoreScope.workflowId,
      sourceCommitSha: wf00RestoreScope.sourceCommitSha,
      backupRunId: backup.runId,
    });
    r.writeIntentRecorded = true;
    stage = 'transport_failed';
    r.putAttempted = true;
    try {
      const saved = await request('PUT', body);
      r.putAcknowledged = saved?.status === 200;
    } catch (error) {
      const d = (ports.transportDiagnostic ?? foundationTransportDiagnostic)(error);
      if (!d || d.transportCode === 'unclassified' || d.transportCode === 'FOUNDATION_TRANSPORT_CLOSE') {
        r.networkCompletionVerified = false;
        r.diagnostic = 'completion_unverified';
        r.status = 'wf00_restore_reconciliation_required';
        return r;
      }
    }
    // One fixed readback also reconciles a closed transport's lost PUT ACK.
    stage = 'readback_mismatch';
    const after = await request('GET');
    if (
      after?.status !== 200 ||
      !object(after.body) ||
      JSON.stringify(after.body).includes(privateKey) ||
      after.body.versionId === dto.versionId ||
      (after.body.activeVersion !== undefined && after.body.activeVersion !== null) ||
      !Array.isArray(after.body.shared) ||
      after.body.shared.length !== 1 ||
      after.body.shared[0]?.projectId !== foundationScope.projectId ||
      after.body.shared[0]?.role !== 'workflow:owner'
    )
      fail();
    const nativeAfter = foundationNativeReadonlySettings(after.body.settings);
    if (!isDeepStrictEqual(nativeBefore, nativeAfter)) fail();
    const projected = projectSavedGraph(after.body, graph, wf00RestoreScope.workflowId, {
      editableSettingsOnly: true,
    });
    const finalDiagnosis = diagnoseFoundationRuntimeBaseline(
      after.body,
      { ...baseline, versionId: projected.versionId },
      foundationScope.projectId,
      { editableSettingsOnly: true },
    );
    if (finalDiagnosis.failedChecks.length !== 0) fail();
    r.exactContentVerified = true;
    r.inactiveVerified = true;
    r.ownerAndTagsVerified = true;
    r.versionId = projected.versionId;
    r.nativeStorageModePreserved = true;
    stage = 'intent_recorded';
    append({
      event: 'restore_verified',
      workflowId: wf00RestoreScope.workflowId,
      versionId: projected.versionId,
      backupRunId: backup.runId,
      ...(nativeBefore.binaryMode === null ? {} : { nativeReadonlySettings: nativeBefore }),
    });
    r.status = r.putAcknowledged ? 'wf00_restore_verified' : 'wf00_restore_reconciled';
    r.diagnostic = null;
    return r;
  } catch {
    r.diagnostic = stage;
    if (r.putAttempted) r.status = 'wf00_restore_reconciliation_required';
    return r;
  }
}
export const shellSpecs = Object.freeze(
  Object.entries(foundationWorkflowNames).map(([key, name]) => Object.freeze({ key, name })),
);
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const fail = () => {
  throw Error('FOUNDATION_PROVISION_BLOCKED');
};
const id = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const specFor = (key) => shellSpecs.find((x) => x.key === key) ?? fail();
export function buildShell(key) {
  const spec = specFor(key),
    nodeId = createHash('sha256')
      .update('emr-m03-foundation:' + foundationScope.windowId + ':' + key)
      .digest('hex')
      .slice(0, 32);
  return {
    name: spec.name,
    projectId: foundationScope.projectId,
    nodes: [
      {
        id: nodeId,
        name: 'Owned inactive shell',
        type: 'n8n-nodes-base.noOp',
        typeVersion: 1,
        parameters: {},
        position: [0, 0],
        notes: 'emr-m03-foundation:' + foundationScope.windowId + ':' + key,
      },
    ],
    connections: {},
    settings: {
      timezone: 'Africa/Cairo',
      executionOrder: 'v1',
      executionTimeout: 15,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
      saveExecutionProgress: false,
      callerPolicy: 'none',
    },
  };
}
function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function verifyShell(dto, key, privateKey = '') {
  const expected = buildShell(key);
  if (
    !object(dto) ||
    !id(dto.id) ||
    dto.name !== expected.name ||
    dto.active !== false ||
    dto.activeVersionId !== null ||
    dto.isArchived !== false ||
    !id(dto.versionId) ||
    !Array.isArray(dto.shared) ||
    !dto.shared.some(
      (x) => object(x) && x.projectId === foundationScope.projectId && x.role === 'workflow:owner',
    ) ||
    !Array.isArray(dto.nodes) ||
    dto.nodes.length !== 1 ||
    !object(dto.nodes[0]) ||
    !object(dto.settings) ||
    !equal(dto.connections, {})
  )
    fail();
  const node = dto.nodes[0],
    want = expected.nodes[0];
  for (const k of Object.keys(want)) if (!equal(node[k], want[k])) fail();
  if (Object.hasOwn(node, 'credentials') || node.retryOnFail === true || Object.hasOwn(node, 'webhookId'))
    fail();
  for (const k of Object.keys(expected.settings)) if (dto.settings[k] !== expected.settings[k]) fail();
  const sanitized = {
    id: dto.id,
    versionId: dto.versionId,
    active: false,
    activeVersionId: null,
    isArchived: false,
    projectId: foundationScope.projectId,
    workflow: { name: expected.name, nodes: expected.nodes, connections: {}, settings: expected.settings },
  };
  if (privateKey && JSON.stringify(sanitized).includes(privateKey)) fail();
  return sanitized;
}
export function parseLedger(rows) {
  if (!Array.isArray(rows) || rows.length > 250) fail();
  const state = new Map(),
    seenIds = new Map();
  for (const row of rows) {
    if (!object(row) || !['intent', 'ack', 'verified'].includes(row.event)) fail();
    specFor(row.key);
    if (!exact(row, row.event === 'intent' ? ['event', 'key'] : ['event', 'key', 'id'])) fail();
    let s = state.get(row.key);
    if (row.event === 'intent') {
      if (s) fail();
      state.set(row.key, { intent: true, id: null, verified: false });
      continue;
    }
    if (
      !s ||
      !id(row.id) ||
      (s.id !== null && s.id !== row.id) ||
      (seenIds.has(row.id) && seenIds.get(row.id) !== row.key)
    )
      fail();
    if (row.event === 'verified' && s.id === null) fail();
    if (row.event === 'ack' && s.verified) fail();
    s.id = row.id;
    s.verified = row.event === 'verified';
    seenIds.set(row.id, row.key);
  }
  return state;
}
export function memoryJournal(initial = []) {
  const rows = structuredClone(initial);
  parseLedger(rows);
  return {
    rows,
    append(row) {
      parseLedger([...rows, row]);
      rows.push(structuredClone(row));
    },
  };
}
function projectVerified(body) {
  return (
    object(body) &&
    Array.isArray(body.data) &&
    body.data.length <= 100 &&
    body.data.some((x) => object(x) && x.id === foundationScope.projectId && x.type === 'personal')
  );
}
export async function runShellProvision(privateKey, journal, send, options = {}) {
  const result = {
    version: 1,
    windowId: foundationScope.windowId,
    environment: 'dev',
    host: foundationScope.host,
    projectId: foundationScope.projectId,
    status: 'blocked',
    requestCount: 0,
    shells: [],
    finalGraphsBound: false,
    gatewayWindowStarted: false,
    executionCount: 0,
    credentialsCreated: 0,
    networkCompletionVerified: true,
  };
  if (
    typeof privateKey !== 'string' ||
    !privateKey ||
    privateKey.length > 4096 ||
    /[^\x21-\x7e]/.test(privateKey) ||
    !journal ||
    typeof journal.append !== 'function' ||
    typeof send !== 'function'
  )
    return result;
  try {
    let state = parseLedger(journal.rows);
    if (!options.reconcileOnly && [...state.values()].some((s) => s.id === null)) {
      result.status = 'reconcile_required';
      return result;
    }
    const request = async (method, path, body = null) => {
      if (++result.requestCount > foundationScope.maxRequests) fail();
      return send(method, path, body, privateKey);
    };
    const p = await request('GET', '/api/v1/projects?limit=100');
    if (p.status !== 200 || !projectVerified(p.body)) fail();
    const existing = new Map();
    let cursor = null;
    for (let page = 0; page < 2; page++) {
      const path =
        '/api/v1/workflows?projectId=' +
        foundationScope.projectId +
        '&excludePinnedData=true&name=' +
        encodeURIComponent(foundationScope.workflowNameFilter) +
        '&limit=100' +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      const r = await request('GET', path);
      if (r.status !== 200 || !object(r.body) || !Array.isArray(r.body.data) || r.body.data.length > 100)
        fail();
      for (const dto of r.body.data) {
        if (!object(dto)) fail();
        const spec = shellSpecs.find((x) => x.name === dto.name);
        if (!spec) continue;
        if (existing.has(spec.key) || !state.has(spec.key)) fail();
        existing.set(spec.key, verifyShell(dto, spec.key, privateKey));
      }
      const next = r.body.nextCursor;
      if (next === null || next === undefined) {
        cursor = null;
        break;
      }
      if (
        typeof next !== 'string' ||
        !next ||
        next.length > 400 ||
        /[\x00-\x20\x7f]/.test(next) ||
        next === cursor
      )
        fail();
      cursor = next;
    }
    if (cursor !== null) fail();
    if (options.reconcileOnly) {
      for (const [key, s] of state) {
        const r = existing.get(key);
        if (!r || (s.id !== null && r.id !== s.id)) fail();
        if (s.id === null) journal.append({ event: 'ack', key, id: r.id });
        if (!s.verified) journal.append({ event: 'verified', key, id: r.id });
        result.shells.push({ key, ...r });
      }
      result.status = 'reconciliation_complete';
      return result;
    }
    for (const spec of shellSpecs) {
      state = parseLedger(journal.rows);
      const s = state.get(spec.key);
      let workflowId;
      if (s) {
        if (!s.id || !existing.has(spec.key) || existing.get(spec.key).id !== s.id) fail();
        workflowId = s.id;
      } else {
        journal.append({ event: 'intent', key: spec.key });
        const created = await request('POST', '/api/v1/workflows', buildShell(spec.key));
        if (created.status !== 200 && created.status !== 201) fail();
        const ack = verifyShell(created.body, spec.key, privateKey);
        workflowId = ack.id;
        journal.append({ event: 'ack', key: spec.key, id: workflowId });
      }
      const readback = await request('GET', '/api/v1/workflows/' + workflowId);
      if (readback.status !== 200) fail();
      const saved = verifyShell(readback.body, spec.key, privateKey);
      if (saved.id !== workflowId) fail();
      if (!s?.verified) journal.append({ event: 'verified', key: spec.key, id: workflowId });
      result.shells.push({ key: spec.key, ...saved });
    }
    result.status = 'shells_verified';
  } catch {
    result.status = 'blocked';
    result.networkCompletionVerified = false;
  }
  return result;
}
