import { isDeepStrictEqual } from 'node:util';
import {
  assertFoundationRuntimePlan,
  assertFoundationRuntimeCaseDraft,
  foundationRuntimeBodyAllowed,
  freezeRuntimeValue,
  runtimeHash,
} from './foundation-runtime-plan.mjs';
import { assertFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';
import { claimFoundationLiveBaselineReceipt } from './foundation-live-runtime-transport.mjs';
import {
  foundationRuntimeGraphHash,
  foundationRuntimePublishedHash,
  diagnoseFoundationRuntimeBaseline,
  foundationRuntimeObservedGraphHash,
} from './foundation-runtime-checkpoint.mjs';
export { diagnoseFoundationRuntimeBaseline } from './foundation-runtime-checkpoint.mjs';

const fail = () => {
  throw Error('FOUNDATION_RUNTIME_CONTROL_BLOCKED');
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const sha = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const versionTimestamp = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
const exact = (v, k) =>
  object(v) && Object.keys(v).length === k.length && k.every((x) => Object.hasOwn(v, x));
const guardDiagnostics = new WeakMap();
export function foundationRuntimeGuardDiagnostic(journal) {
  return guardDiagnostics.get(journal) ?? null;
}
const initialStates = new WeakMap();
const frozenGraphHashes = new WeakMap();
const checkedJournals = new WeakSet();
const activeJournals = new WeakSet();
const checkedCaseReceipts = new WeakSet();
const savedCaseBodies = new WeakMap();
const nativeGraphObservations = new WeakMap();
const checkedBindings = new WeakMap();
const restorationAudits = new WeakMap();
export function assertFoundationRuntimeRestorationAudit(receipt, { plan }) {
  const meta = receipt && restorationAudits.get(receipt);
  if (!meta || !Object.isFrozen(receipt) || meta.plan !== plan) fail();
  const state = foundationRuntimeState(plan, meta.journal);
  if (
    !state.restoreComplete ||
    state.pending ||
    state.machineRebound ||
    state.requestCount !== meta.requestCount
  )
    fail();
  return receipt;
}
function requireSynchronousVoid(value) {
  if (value !== undefined) {
    if (value && typeof value.then === 'function') Promise.resolve(value).catch(() => {});
    fail();
  }
}
function prepareSynchronousMachinePatch(ports, scope) {
  const value = ports.prepareMachinePatch(scope);
  if (value && typeof value.then === 'function') {
    Promise.resolve(value).catch(() => {});
    fail();
  }
  return assertFoundationRuntimeMachinePatch(value, scope);
}
function enter(journal) {
  if (activeJournals.has(journal)) return false;
  activeJournals.add(journal);
  return true;
}
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (!object(v)) return v;
  return Object.fromEntries(
    Object.keys(v)
      .sort()
      .map((k) => [k, sorted(v[k])]),
  );
}
export function runtimeGraphHash(body) {
  if (Object.isFrozen(body) && frozenGraphHashes.has(body)) return frozenGraphHashes.get(body);
  const value = foundationRuntimeGraphHash(body);
  if (Object.isFrozen(body)) frozenGraphHashes.set(body, value);
  return value;
}
const publishedHash = foundationRuntimePublishedHash;
function metadata(dto, plan) {
  if (
    !object(dto) ||
    Object.hasOwn(dto, 'data') ||
    dto.id !== plan.machine.id ||
    dto.name !== plan.machine.name ||
    dto.type !== 'httpCustomAuth' ||
    dto.createdAt !== plan.machine.createdAt ||
    !versionTimestamp(dto.updatedAt) ||
    ['isManaged', 'isGlobal', 'isResolvable'].some((k) => dto[k] !== undefined && dto[k] !== false) ||
    (dto.resolverId !== undefined && dto.resolverId !== null)
  )
    fail();
  return { id: dto.id, createdAt: dto.createdAt, updatedAt: dto.updatedAt };
}
function graphReceipt(dto, plan, key, want) {
  const b = plan.baseline.find((r) => r.key === key);
  if (
    !b ||
    !object(dto) ||
    dto.id !== b.id ||
    dto.isArchived !== false ||
    dto.active !== (want.activeVersionId !== null) ||
    dto.activeVersionId !== want.activeVersionId ||
    !id(dto.versionId) ||
    (want.versionId !== null && dto.versionId !== want.versionId) ||
    !Array.isArray(dto.shared) ||
    !dto.shared.some((s) => s.projectId === plan.projectId && s.role === 'workflow:owner') ||
    !Array.isArray(dto.tags) ||
    !isDeepStrictEqual(
      sorted(dto.tags.map((t) => ({ id: t.id, name: t.name })).sort((a, z) => a.id.localeCompare(z.id))),
      sorted([...b.tags].sort((a, z) => a.id.localeCompare(z.id))),
    ) ||
    (dto.pinData !== undefined &&
      dto.pinData !== null &&
      (!object(dto.pinData) || Object.keys(dto.pinData).length))
  )
    fail();
  const graphHash = foundationRuntimeObservedGraphHash(dto, b);
  if (graphHash !== want.graphHash) fail();
  if (
    want.activeVersionId !== null &&
    (!object(dto.activeVersion) ||
      dto.activeVersion.workflowId !== b.id ||
      dto.activeVersion.versionId !== want.activeVersionId ||
      publishedHash(dto.activeVersion) !== want.publishedHash)
  )
    fail();
  return {
    versionId: dto.versionId,
    activeVersionId: dto.activeVersionId,
    graphHash,
    publishedHash: want.publishedHash,
  };
}
function initialState(plan) {
  if (!initialStates.has(plan))
    initialStates.set(plan, {
      workflows: Object.fromEntries(
        plan.baseline.map((b) => [
          b.key,
          {
            versionId: b.versionId,
            activeVersionId: null,
            graphHash: runtimeGraphHash(b.body),
            publishedHash: null,
          },
        ]),
      ),
      setupComplete: false,
      restoreComplete: false,
      machineRebound: false,
      machineUpdatedAt: null,
      publishedHistory: [],
      pending: null,
      requestCount: 0,
    });
  return structuredClone(initialStates.get(plan));
}
function reduce(plan, rows) {
  if (!Array.isArray(rows) || rows.length > 1800) fail();
  const s = initialState(plan);
  let header = false,
    nextSequence = 1;
  for (const r of rows) {
    if (!object(r)) fail();
    if (r.event === 'header') {
      if (
        header ||
        !exact(r, ['event', 'version', 'planHash']) ||
        r.version !== 1 ||
        r.planHash !== plan.planHash
      )
        fail();
      header = true;
      continue;
    }
    if (!header) fail();
    if (s.restoreComplete) fail();
    if (r.event === 'request') {
      if (
        !exact(r, ['event', 'number', 'method', 'path']) ||
        r.number !== ++s.requestCount ||
        s.requestCount > 512 ||
        !['GET', 'PUT', 'POST', 'PATCH'].includes(r.method) ||
        typeof r.path !== 'string' ||
        r.path.length > 300
      )
        fail();
      const workflow =
        /^\/api\/v1\/workflows\/([A-Za-z0-9_-]{1,128})(\?excludePinnedData=true|\?publishIfActive=false|\/publish|\/unpublish)$/.exec(
          r.path,
        );
      const owned = workflow && plan.baseline.find((b) => b.id === workflow[1]);
      if (r.method === 'GET') {
        if (!(
          ['/api/v1/credentials/schema/httpCustomAuth', '/api/v1/credentials/' + plan.machine.id].includes(
            r.path,
          ) ||
          (owned && workflow[2] === '?excludePinnedData=true')
        ))
          fail();
      } else {
        const pending = s.pending;
        if (
          !pending ||
          (pending.action.startsWith('machine_')
            ? r.method !== 'PATCH' || r.path !== '/api/v1/credentials/' + plan.machine.id
            : !owned ||
              pending.key !== owned.key ||
              (pending.action === 'save'
                ? r.method !== 'PUT' || workflow[2] !== '?publishIfActive=false'
                : r.method !== 'POST' || workflow[2] !== '/' + pending.action))
        )
          fail();
      }
    } else if (r.event === 'intent') {
      if (
        s.pending ||
        !exact(r, ['event', 'sequence', 'action', 'key', 'before', 'target']) ||
        r.sequence !== nextSequence++ ||
        !['save', 'publish', 'unpublish', 'machine_rebind', 'machine_restore'].includes(r.action)
      )
        fail();
      if (r.action.startsWith('machine_')) {
        if (
          r.key !== 'Machine' ||
          r.before !== s.machineUpdatedAt ||
          !['runtime', 'baseline'].includes(r.target)
        )
          fail();
      } else if (
        !Object.hasOwn(s.workflows, r.key) ||
        !isDeepStrictEqual(r.before, s.workflows[r.key]) ||
        !sha(r.target.graphHash) ||
        !(r.target.activeVersionId === null || id(r.target.activeVersionId)) ||
        !(r.target.publishedHash === null || sha(r.target.publishedHash)) ||
        (r.action === 'publish' && !plan.publishKeys.includes(r.key))
      )
        fail();
      s.pending = r;
    } else if (r.event === 'verified') {
      const p = s.pending;
      if (!p || !exact(r, ['event', 'sequence', 'after']) || r.sequence !== p.sequence) fail();
      if (p.action.startsWith('machine_')) {
        if (!exact(r.after, ['updatedAt']) || !versionTimestamp(r.after.updatedAt)) fail();
        s.machineUpdatedAt = r.after.updatedAt;
        s.machineRebound = p.action === 'machine_rebind';
      } else {
        if (
          !exact(r.after, ['versionId', 'activeVersionId', 'graphHash', 'publishedHash']) ||
          !id(r.after.versionId) ||
          (p.target.versionId !== null && r.after.versionId !== p.target.versionId) ||
          r.after.graphHash !== p.target.graphHash ||
          r.after.activeVersionId !== p.target.activeVersionId ||
          r.after.publishedHash !== p.target.publishedHash
        )
          fail();
        s.workflows[p.key] = structuredClone(r.after);
        if (p.action === 'publish') s.publishedHistory.push(p.key);
      }
      s.pending = null;
    } else if (r.event === 'machine_observed') {
      if (
        s.pending ||
        s.machineUpdatedAt !== null ||
        !exact(r, ['event', 'updatedAt']) ||
        !versionTimestamp(r.updatedAt)
      )
        fail();
      s.machineUpdatedAt = r.updatedAt;
    } else if (r.event === 'setup_complete') {
      if (s.pending || s.setupComplete || !s.machineRebound || !exact(r, ['event'])) fail();
      for (const r of plan.runtime) {
        const current = s.workflows[r.key];
        if (
          current.graphHash !== runtimeGraphHash(r.body) ||
          (plan.publishKeys.includes(r.key)
            ? current.activeVersionId !== current.versionId
            : current.activeVersionId !== null)
        )
          fail();
      }
      s.setupComplete = true;
    } else if (r.event === 'restore_complete') {
      if (
        s.pending ||
        s.restoreComplete ||
        s.machineRebound ||
        Object.values(s.workflows).some((w) => w.activeVersionId !== null) ||
        !exact(r, ['event'])
      )
        fail();
      for (const b of plan.baseline) if (s.workflows[b.key].graphHash !== runtimeGraphHash(b.body)) fail();
      s.restoreComplete = true;
    } else fail();
  }
  return s;
}
export function createFoundationRuntimeJournal(plan, initial, durableAppend) {
  assertFoundationRuntimePlan(plan);
  if (!Array.isArray(initial) || typeof durableAppend !== 'function') fail();
  const rows = structuredClone(initial);
  reduce(plan, rows);
  const j = {
    get rows() {
      return freezeRuntimeValue(structuredClone(rows));
    },
    append(row) {
      reduce(plan, [...rows, row]);
      requireSynchronousVoid(durableAppend(structuredClone(row)));
      rows.push(structuredClone(row));
    },
  };
  if (!rows.length) j.append({ event: 'header', version: 1, planHash: plan.planHash });
  checkedJournals.add(j);
  Object.freeze(j);
  return j;
}
export function foundationRuntimeState(plan, journal) {
  assertFoundationRuntimePlan(plan);
  return reduce(plan, journal.rows);
}
function controller(plan, ports) {
  assertFoundationRuntimePlan(plan);
  if (
    !ports ||
    typeof ports.send !== 'function' ||
    typeof ports.admitManagementAttempt !== 'function' ||
    typeof ports.prepareMachinePatch !== 'function' ||
    typeof ports.journal?.append !== 'function' ||
    !checkedJournals.has(ports.journal)
  )
    fail();
  const state = () => reduce(plan, ports.journal.rows);
  const request = async (method, path, body = null) => {
    const s = state();
    if (s.requestCount >= 512 || !foundationRuntimeRequestAllowed(plan, method, path, body)) fail();
    // The caller's shared durable 512-management-attempt coordinator also counts
    // external runtime preflight/recovery checks. Refusal precedes the request.
    requireSynchronousVoid(ports.admitManagementAttempt());
    ports.journal.append({ event: 'request', number: s.requestCount + 1, method, path });
    const r = await ports.send(method, path, body);
    if (!object(r) || r.status !== 200) fail();
    return r.body;
  };
  const read = async (key, want = state().workflows[key]) => {
    guardDiagnostics.delete(ports.journal);
    const dto = await request(
      'GET',
      '/api/v1/workflows/' + plan.baseline.find((b) => b.key === key).id + '?excludePinnedData=true',
    );
    let receipt;
    try {
      receipt = graphReceipt(dto, plan, key, want);
    } catch {
      const baseline = plan.baseline.find((b) => b.key === key);
      if (
        want.versionId === baseline.versionId &&
        want.activeVersionId === null &&
        want.graphHash === runtimeGraphHash(baseline.body)
      )
        guardDiagnostics.set(ports.journal, diagnoseFoundationRuntimeBaseline(dto, baseline, plan.projectId));
      throw Error('FOUNDATION_RUNTIME_CONTROL_BLOCKED');
    }
    if (!nativeGraphObservations.has(ports.journal)) nativeGraphObservations.set(ports.journal, new Map());
    nativeGraphObservations.get(ports.journal).set(key, {
      plan,
      receipt: freezeRuntimeValue(receipt),
      requestNumber: state().requestCount,
    });
    return receipt;
  };
  const transition = async (action, key, body = null) => {
    const s = state();
    if (s.pending || s.restoreComplete || !Object.hasOwn(s.workflows, key)) fail();
    const before = s.workflows[key],
      b = plan.baseline.find((v) => v.key === key);
    await read(key);
    if (
      action === 'publish' &&
      (!plan.publishKeys.includes(key) || before.activeVersionId !== null || body !== null)
    )
      fail();
    if (action === 'unpublish' && (before.activeVersionId === null || body !== null)) fail();
    if (
      action === 'save' &&
      (!object(body) ||
        (body.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger' && n.disabled !== true) &&
          body !== b.body))
    )
      fail();
    const target =
      action === 'save'
        ? { ...before, versionId: null, graphHash: runtimeGraphHash(body) }
        : action === 'publish'
          ? {
              ...before,
              activeVersionId: before.versionId,
              publishedHash: publishedHash(body ?? plan.runtime.find((r) => r.key === key).body),
            }
          : { ...before, activeVersionId: null, publishedHash: null };
    const sequence = ports.journal.rows.filter((r) => r.event === 'intent').length + 1;
    ports.journal.append({ event: 'intent', sequence, action, key, before, target });
    let response;
    if (action === 'save') {
      const wire = structuredClone(body);
      // Native settings merge: omission retains a previous errorWorkflow. DEFAULT
      // is the documented clear sentinel and is removed from stored readback.
      if (!Object.hasOwn(wire.settings, 'errorWorkflow')) wire.settings.errorWorkflow = 'DEFAULT';
      response = await request('PUT', '/api/v1/workflows/' + b.id + '?publishIfActive=false', wire);
      if (
        !object(response) ||
        response.id !== b.id ||
        !id(response.versionId) ||
        response.versionId === before.versionId
      )
        fail();
      target.versionId = response.versionId;
    } else if (action === 'publish') {
      await request('POST', '/api/v1/workflows/' + b.id + '/publish', { versionId: before.versionId });
    } else await request('POST', '/api/v1/workflows/' + b.id + '/unpublish', null);
    const after = await read(key, target);
    ports.journal.append({ event: 'verified', sequence, after });
    return after;
  };
  const changeMachine = async (restore = false) => {
    const s = state();
    if (s.pending || s.restoreComplete || s.machineUpdatedAt === null) fail();
    const patchScope = { audience: restore ? plan.oldAudience : plan.setup.audience, restore };
    const patch = prepareSynchronousMachinePatch(ports, patchScope);
    const before = metadata(await request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
    if (before.updatedAt !== s.machineUpdatedAt) fail();
    const sequence = ports.journal.rows.filter((r) => r.event === 'intent').length + 1;
    ports.journal.append({
      event: 'intent',
      sequence,
      action: restore ? 'machine_restore' : 'machine_rebind',
      key: 'Machine',
      before: before.updatedAt,
      target: restore ? 'baseline' : 'runtime',
    });
    const changed = metadata(await request('PATCH', '/api/v1/credentials/' + plan.machine.id, patch), plan);
    const after = metadata(await request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
    if (!isDeepStrictEqual(changed, after)) fail();
    ports.journal.append({ event: 'verified', sequence, after: { updatedAt: after.updatedAt } });
  };
  return { state, request, read, transition, changeMachine };
}
export function foundationRuntimeRequestAllowed(plan, method, path, body) {
  assertFoundationRuntimePlan(plan);
  if (
    method === 'GET' &&
    body === null &&
    ['/api/v1/credentials/schema/httpCustomAuth', '/api/v1/credentials/' + plan.machine.id].includes(path)
  )
    return true;
  if (method === 'PATCH' && path === '/api/v1/credentials/' + plan.machine.id) {
    for (const scope of [
      { audience: plan.setup.audience, restore: false },
      { audience: plan.oldAudience, restore: true },
    ]) {
      try {
        assertFoundationRuntimeMachinePatch(body, scope);
        return true;
      } catch {
        /* fixed denial; no credential string rendered */
      }
    }
    return false;
  }
  const m =
    /^\/api\/v1\/workflows\/([A-Za-z0-9_-]{1,128})(\?excludePinnedData=true|\?publishIfActive=false|\/publish|\/unpublish)$/.exec(
      path,
    );
  const owned = m && plan.baseline.find((b) => b.id === m[1]);
  if (!owned) return false;
  if (method === 'GET') return m[2] === '?excludePinnedData=true' && body === null;
  if (method === 'POST' && m[2] === '/publish')
    return plan.publishKeys.includes(owned.key) && exact(body, ['versionId']) && id(body.versionId);
  if (method === 'POST' && m[2] === '/unpublish')
    return body === null && plan.publishKeys.includes(owned.key);
  return (
    method === 'PUT' &&
    m[2] === '?publishIfActive=false' &&
    exact(body, ['name', 'nodes', 'connections', 'settings']) &&
    body.name === owned.body.name &&
    foundationRuntimeBodyAllowed(plan, body)
  );
}
const result = (c, status) => ({
  status,
  requestCount: c.state().requestCount,
  pendingMutation: c.state().pending !== null,
  setupComplete: c.state().setupComplete,
  restoreComplete: c.state().restoreComplete,
  currentlyPublished: Object.entries(c.state().workflows)
    .filter(([, w]) => w.activeVersionId !== null)
    .map(([key]) => key),
  credentialsCreated: 0,
  executionsStarted: 0,
  actorStarts: 0,
});
export async function runFoundationRuntimeSetup(plan, ports) {
  const c = controller(plan, ports);
  if (!enter(ports.journal)) return result(c, 'operation_in_progress');
  try {
    if (c.state().requestCount || c.state().setupComplete || c.state().pending)
      return result(c, 'reconciliation_required');
    if (ports.baselinePreflightReceipt === undefined) {
      for (const b of plan.baseline) await c.read(b.key);
    } else {
      claimFoundationLiveBaselineReceipt(ports.baselinePreflightReceipt, {
        baseline: plan.baseline,
        deadlineAt: ports.deadlineAt,
        managementBudget: ports.managementBudget,
      });
    }
    const schema = await c.request('GET', '/api/v1/credentials/schema/httpCustomAuth');
    if (
      !object(schema?.properties) ||
      !['json', 'allowedDomains', 'allowedHttpRequestDomains'].every((k) =>
        Object.hasOwn(schema.properties, k),
      )
    )
      fail();
    const patchScope = { audience: plan.setup.audience, restore: false };
    const patch = prepareSynchronousMachinePatch(ports, patchScope);
    const first = metadata(await c.request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
    // Creation identifies the dedicated owned credential; it does not establish
    // its saved update version or reveal its token/domain. Qualify the current
    // version, then require an immediate fresh match before the known-custody
    // temporary rebind. This is a conflict guard, not compare-and-swap.
    ports.journal.append({ event: 'machine_observed', updatedAt: first.updatedAt });
    const current = metadata(await c.request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
    if (!isDeepStrictEqual(current, first)) fail();
    const sequence = ports.journal.rows.filter((r) => r.event === 'intent').length + 1;
    ports.journal.append({
      event: 'intent',
      sequence,
      action: 'machine_rebind',
      key: 'Machine',
      before: first.updatedAt,
      target: 'runtime',
    });
    const changed = metadata(await c.request('PATCH', '/api/v1/credentials/' + plan.machine.id, patch), plan);
    const readback = metadata(await c.request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
    if (!isDeepStrictEqual(changed, readback)) fail();
    ports.journal.append({ event: 'verified', sequence, after: { updatedAt: readback.updatedAt } });
    for (const step of plan.setupSteps) await c.transition(step.kind, step.key, step.body ?? null);
    ports.journal.append({ event: 'setup_complete' });
    return result(c, 'runtime_setup_verified');
  } catch {
    return result(c, c.state().pending ? 'reconciliation_required' : 'blocked');
  } finally {
    activeJournals.delete(ports.journal);
  }
}
export async function saveFoundationRuntimeCase(plan, draft, ports) {
  const c = controller(plan, ports);
  if (!enter(ports.journal)) return result(c, 'operation_in_progress');
  try {
    assertFoundationRuntimeCaseDraft(draft);
    if (
      !c.state().setupComplete ||
      c.state().restoreComplete ||
      c.state().pending ||
      draft?.kind !== 'proposed_owned_runtime_case_draft' ||
      draft.publish !== false ||
      draft.id !== plan.baseline.find((b) => b.key === draft.key)?.id ||
      runtimeHash(draft.body) !== draft.bodyHash ||
      draft.body.settings.availableInMCP !== true ||
      draft.body.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger' && n.disabled !== true)
        .length !== 1 ||
      c.state().requestCount + 3 + (plan.publishKeys.length * 3 + 75 + 3) + 25 > 512
    )
      fail();
    await c.transition('save', draft.key, draft.body);
    const receipt = Object.freeze({
      ...result(c, 'case_draft_verified'),
      caseId: draft.caseId,
      workflowId: draft.id,
      versionId: c.state().workflows[draft.key].versionId,
      bodyHash: draft.bodyHash,
    });
    checkedCaseReceipts.add(receipt);
    savedCaseBodies.set(receipt, { plan, journal: ports.journal, draft });
    return receipt;
  } catch {
    return result(c, c.state().pending ? 'reconciliation_required' : 'blocked');
  } finally {
    activeJournals.delete(ports.journal);
  }
}
export function assertFoundationRuntimeCaseReceipt(receipt) {
  if (
    !object(receipt) ||
    !checkedCaseReceipts.has(receipt) ||
    !Object.isFrozen(receipt) ||
    receipt.status !== 'case_draft_verified'
  )
    fail();
  return receipt;
}

function currentBindingState(plan, key, journal, body) {
  assertFoundationRuntimePlan(plan);
  if (!checkedJournals.has(journal) || activeJournals.has(journal)) fail();
  const state = reduce(plan, journal.rows);
  const current = state.workflows[key];
  const observed = nativeGraphObservations.get(journal)?.get(key);
  if (
    !state.setupComplete ||
    state.restoreComplete ||
    state.pending ||
    !current ||
    !observed ||
    observed.plan !== plan ||
    !isDeepStrictEqual(observed.receipt, current) ||
    (current.activeVersionId !== null && current.activeVersionId !== current.versionId) ||
    runtimeGraphHash(body) !== current.graphHash
  )
    fail();
  return current;
}

// No new request or caller-supplied native DTO: only a controller's successful
// owned GET plus its matching current durable state can produce this binding.
// The execution reader must still GET the current graph and native snapshot;
// this local proof is not compare-and-swap or a permanent freshness guarantee.
export function createFoundationRuntimeBinding(plan, key, ports, options = {}) {
  const c = controller(plan, ports);
  if (!object(options) || Object.keys(options).some((k) => k !== 'caseReceipt')) fail();
  let body = plan.runtime.find((r) => r.key === key)?.body;
  if (Object.hasOwn(options, 'caseReceipt')) {
    const receipt = assertFoundationRuntimeCaseReceipt(options.caseReceipt);
    const saved = savedCaseBodies.get(receipt);
    if (
      !saved ||
      saved.plan !== plan ||
      saved.journal !== ports.journal ||
      saved.draft.key !== key ||
      receipt.versionId !== c.state().workflows[key]?.versionId
    )
      fail();
    body = saved.draft.body;
  }
  if (!body) fail();
  const current = currentBindingState(plan, key, ports.journal, body);
  const binding = freezeRuntimeValue({
    workflowId: plan.baseline.find((r) => r.key === key).id,
    versionId: current.versionId,
    activeVersionId: current.activeVersionId,
    bodyHash: current.graphHash,
    body,
    runtimeAudience: plan.setup.audience,
    ...(Object.hasOwn(
      plan.baseline.find((r) => r.key === key),
      'nativeReadonlySettings',
    )
      ? { nativeReadonlySettings: plan.baseline.find((r) => r.key === key).nativeReadonlySettings }
      : {}),
  });
  checkedBindings.set(binding, { plan, key, journal: ports.journal });
  return binding;
}

export function assertFoundationRuntimeBinding(binding) {
  const scope = object(binding) && checkedBindings.get(binding);
  if (!scope || !Object.isFrozen(binding)) fail();
  const current = currentBindingState(scope.plan, scope.key, scope.journal, binding.body);
  if (
    binding.workflowId !== scope.plan.baseline.find((r) => r.key === scope.key).id ||
    binding.versionId !== current.versionId ||
    binding.activeVersionId !== current.activeVersionId ||
    binding.bodyHash !== current.graphHash ||
    binding.runtimeAudience !== scope.plan.setup.audience
  )
    fail();
  return binding;
}
export async function restoreFoundationRuntime(plan, ports) {
  const c = controller(plan, ports);
  if (!enter(ports.journal)) return result(c, 'operation_in_progress');
  try {
    if (c.state().pending || c.state().restoreComplete) fail();
    const order = [...new Set(c.state().publishedHistory)].reverse();
    for (const key of order)
      if (c.state().workflows[key].activeVersionId !== null) await c.transition('unpublish', key);
    for (const b of plan.baseline)
      if (c.state().workflows[b.key].graphHash !== runtimeGraphHash(b.body))
        await c.transition('save', b.key, b.body);
    if (c.state().machineRebound) await c.changeMachine(true);
    for (const b of plan.baseline) await c.read(b.key);
    ports.journal.append({ event: 'restore_complete' });
    const receipt = Object.freeze({
      ...result(c, 'exact_staging_restored_unpublished'),
      verifiedWorkflows: 25,
    });
    restorationAudits.set(receipt, { plan, journal: ports.journal, requestCount: c.state().requestCount });
    return receipt;
  } catch {
    return result(c, c.state().pending ? 'reconciliation_required' : 'blocked');
  } finally {
    activeJournals.delete(ports.journal);
  }
}
export async function reconcileFoundationRuntimeReadOnly(plan, ports) {
  const c = controller(plan, ports),
    pending = c.state().pending;
  if (!enter(ports.journal)) return { status: 'operation_in_progress', requestCount: c.state().requestCount };
  try {
    if (!pending) return { status: 'no_pending_mutation', requestCount: c.state().requestCount };
    if (pending.action.startsWith('machine_')) {
      const m = metadata(await c.request('GET', '/api/v1/credentials/' + plan.machine.id), plan);
      return {
        status:
          m.updatedAt === pending.before
            ? 'metadata_unchanged_domain_unverified'
            : 'metadata_changed_domain_unverified',
        requestCount: c.state().requestCount,
        mutationReplayAllowed: false,
      };
    }
    const dto = await c.request(
      'GET',
      '/api/v1/workflows/' + plan.baseline.find((b) => b.key === pending.key).id + '?excludePinnedData=true',
    );
    let state = 'drift_or_unknown';
    try {
      graphReceipt(dto, plan, pending.key, pending.before);
      state = 'matching_before_no_replay';
    } catch {
      /* fixed classification only */
    }
    if (state === 'drift_or_unknown') {
      try {
        graphReceipt(dto, plan, pending.key, pending.target);
        state = 'matching_target_unattributed';
      } catch {
        /* no adoption of unknown version */
      }
    }
    return { status: state, requestCount: c.state().requestCount, mutationReplayAllowed: false };
  } catch {
    return {
      status: 'readback_unavailable',
      requestCount: c.state().requestCount,
      mutationReplayAllowed: false,
    };
  } finally {
    activeJournals.delete(ports.journal);
  }
}
