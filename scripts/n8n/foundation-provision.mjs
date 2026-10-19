import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import { createHash } from 'node:crypto';

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
