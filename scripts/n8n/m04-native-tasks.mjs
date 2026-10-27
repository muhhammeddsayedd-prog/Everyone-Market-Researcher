// Three owned M04 definitions only. The coordinator supplies the existing
// private transport, durable ledger and encrypted state persistence. No secret
// loading, execution, provider request, schedule or transport lives here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  buildNativeCollector,
  extendNativeCallback,
  withManualCollectorEntry,
  withManualOrchestratorEntry,
  buildNativeOrchestrator,
  buildNativeCallback,
  buildNativeErrorHandler,
} from '../../n8n/collectors/build-native-collectors.mjs';
import {
  foundationRuntimeGraphHash,
  foundationRuntimeExecutionParameterCandidates,
  foundationEditableSettings,
  foundationNativeReadonlySettings,
} from './foundation-runtime-checkpoint.mjs';
import { prepareFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';

const keys = ['WF-10', 'WF-11', 'WF-19'];
const incrementalApprovalId = '123e88b6-5920-4e54-832a-ad6d87c22675';
const errorKey = 'WF-90-M04';
const historicalVimeoPair = ['985a57dd-7934-422d-9d18-4e8ca59fc197', '8fefa9a1-3637-43db-843d-97caa9afcc79'];
const machine = { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' };
const closedFoundationDispatch = {
  name: 'Confirm finish and dispatch stubs',
  target: 'RUTwaXMRh3PgLhJq',
};
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
function withoutClosedFoundationDispatch(graph) {
  const result = structuredClone(graph);
  const matches = result.workflow.nodes.filter((node) => node.name === closedFoundationDispatch.name);
  const node = matches[0];
  if (
    result.key !== 'WF-19' ||
    matches.length !== 1 ||
    node.type !== 'n8n-nodes-base.executeWorkflow' ||
    node.parameters.source !== 'database' ||
    node.parameters.workflowId?.value !== closedFoundationDispatch.target
  )
    fail('WORKFLOW_IDENTITY');
  // n8n@2.43.5 workflow-validation.service.ts:616-660 rejects enabled
  // references to unpublished subworkflows, including conditional branches.
  // This closed M03 dispatch is not an M04 callback dependency. Preserve its
  // parameters, identity and connections for exact baseline restoration.
  node.disabled = true;
  return result;
}

/** Mutates only supplied private state. The coordinator durably records each
 * request intent before network activity and encrypts the inventory baseline
 * before mutation phases; pending intent is also set before injected send. */
export async function runNativeTask({ phase, state, send, bindings, repo, machineToken }) {
  const receipt = { phase, status: 'blocked', code: null, requestCount: 0, needsReconciliation: false };
  const incremental = state.scope === 'incremental';
  const originals = incremental ? ['WF-00', ...keys] : keys;
  const n = (state.native ??= {
    snapshots: {},
    current: {},
    staged: {},
    credentials: {},
    machine: { rebound: false },
    pending: null,
    events: [],
  });
  const request = async (method, path, value = null, statuses = [200]) => {
    receipt.requestCount++;
    const response = await send(method, path, value);
    if (!object(response) || !statuses.includes(response.status) || !object(response.body)) fail();
    return response.body;
  };
  const managedRef = (key) => {
    if (key !== errorKey) {
      if (!originals.includes(key)) fail('WORKFLOW_IDENTITY');
      return bindings.workflowRefs[key];
    }
    const id = n.errorHandler?.id;
    if (
      !incremental ||
      typeof id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      Object.values(bindings.workflowRefs).some((r) => r.id === id) ||
      n.errorHandler.approvalId !== incrementalApprovalId
    )
      fail('WORKFLOW_IDENTITY');
    return { id, name: 'WF-90-M04 · Collector error handler [dev]' };
  };
  const path = (key, suffix = '?excludePinnedData=true') =>
    '/api/v1/workflows/' + managedRef(key).id + suffix;
  const read = async (key) => {
    const dto = await request('GET', path(key));
    return {
      dto,
      metadata: workflowMetadata(dto, key, {
        ...bindings,
        workflowRefs: { ...bindings.workflowRefs, [key]: managedRef(key) },
      }),
    };
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
    if (saved.id !== managedRef(key).id || !/^[A-Za-z0-9_-]{1,128}$/.test(saved.versionId ?? '')) fail();
    n.pending.savedVersionId = saved.versionId;
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
  const approvedPlan = () => {
    const plan = state.orchestratorSelection;
    const selected = state.selection;
    const uuid = (id) =>
      typeof id === 'string' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
    const setEqual = (a, b) =>
      Array.isArray(a) && Array.isArray(b) && isDeepStrictEqual([...a].sort(), [...b].sort());
    if (
      state.approvalId !== incrementalApprovalId ||
      !/^[a-f0-9]{40}$/.test(state.sourceHead ?? '') ||
      !object(selected) ||
      ['vimeo', 'instagram'].some(
        (kind) =>
          !Array.isArray(selected[kind]) ||
          selected[kind].length !== 5 ||
          selected[kind].some((id) => !uuid(id)) ||
          new Set(selected[kind]).size !== 5,
      ) ||
      new Set([...selected.vimeo, ...selected.instagram]).size !== 10 ||
      !historicalVimeoPair.every((id) => selected.vimeo.includes(id)) ||
      !object(plan) ||
      !setEqual(
        plan.vimeo_account_ids,
        selected.vimeo.filter((id) => !historicalVimeoPair.includes(id)),
      ) ||
      !setEqual(plan.instagram_account_ids, selected.instagram) ||
      !isDeepStrictEqual(
        Object.fromEntries(Object.entries(plan).filter(([k]) => !k.endsWith('_account_ids'))),
        {
          mode: 'backfill',
          max_pages: 2,
          page_size: 20,
          results_limit: 50,
          max_actor_starts: 2,
        },
      )
    )
      fail('SELECTION');
    return plan;
  };
  const verifyPublication = (after, before, graph, active) => {
    if (
      after.metadata.active !== active ||
      after.metadata.activeVersionId !== (active ? before.versionId : null) ||
      after.metadata.versionId !== before.versionId ||
      after.metadata.graphHash !== before.graphHash ||
      !isDeepStrictEqual(after.metadata.tags, before.tags) ||
      !isDeepStrictEqual(after.metadata.readonlySettings, before.readonlySettings) ||
      (active &&
        (!object(after.dto.activeVersion) ||
          after.dto.activeVersion.workflowId !== before.id ||
          after.dto.activeVersion.versionId !== before.versionId ||
          !sameBody(
            { ...after.dto.activeVersion, name: after.dto.name, settings: after.dto.settings },
            graph.workflow,
          )))
    )
      fail('DRIFT');
  };
  const setPublication = async (key, graph, active) => {
    const before = await read(key);
    unchanged(before.metadata, n.current[key]);
    if (
      before.metadata.active === active &&
      before.metadata.activeVersionId === (active ? before.metadata.versionId : null)
    )
      return;
    if (active && n.closedPublication?.[key] === before.metadata.versionId) fail('PUBLISH_ATTEMPT_CLOSED');
    n.pending = { key, action: active ? 'publish' : 'unpublish', before: before.metadata };
    await request(
      'POST',
      path(key, active ? '/publish' : '/unpublish'),
      active ? { versionId: before.metadata.versionId } : null,
    );
    const after = await read(key);
    verifyPublication(after, before.metadata, graph, active);
    n.current[key] = after.metadata;
    if (key === errorKey) n.errorHandler.current = after.metadata;
    if (key === 'WF-19') n.published = active;
    completeIntent();
    checkpoint({ action: active ? 'published' : 'unpublished', key, ...after.metadata });
  };
  const ensureOwnedErrorHandler = async () => {
    const graph = buildNativeErrorHandler(bindings, {
      audience: state.deployment?.audience,
      credential: machine,
    });
    // Exact approval marker belongs to the created graph and survives retention.
    graph.workflow.nodes[0].notes = 'emr-m04-incremental:' + incrementalApprovalId;
    n.staged[errorKey] = graph;
    if (!n.errorHandler) {
      n.pending = {
        key: errorKey,
        action: 'create',
        targetHash: hash(graph.workflow),
        approvalId: incrementalApprovalId,
      };
      const created = await request(
        'POST',
        '/api/v1/workflows',
        { ...body(graph.workflow), projectId: bindings.projectId },
        [200, 201],
      );
      if (
        typeof created.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(created.id) ||
        Object.values(bindings.workflowRefs).some((r) => r.id === created.id)
      )
        fail('WORKFLOW_IDENTITY');
      n.errorHandler = {
        id: created.id,
        approvalId: incrementalApprovalId,
        createdGraphHash: hash(graph.workflow),
      };
      n.pending.savedVersionId = created.versionId;
      const after = await read(errorKey);
      if (
        after.metadata.active ||
        after.metadata.activeVersionId !== null ||
        after.metadata.versionId !== created.versionId ||
        !sameBody(after.dto, graph.workflow)
      )
        fail('DRIFT');
      n.snapshots[errorKey] = structuredClone(after.dto);
      n.current[errorKey] = after.metadata;
      n.errorHandler.current = after.metadata;
      completeIntent();
      checkpoint({ action: 'created_owned_error_handler', key: errorKey, ...after.metadata });
    } else {
      managedRef(errorKey);
      const after = await read(errorKey);
      unchanged(after.metadata, n.current[errorKey]);
      if (n.errorHandler.createdGraphHash !== hash(graph.workflow) || !sameBody(after.dto, graph.workflow))
        fail('DRIFT');
    }
    // n8n@2.43.5 ErrorWorkflowValidationService106-123 and WorkflowService162-195:
    // a changed settings.errorWorkflow must target a published Error Trigger.
    // This is required even when the consumer itself remains an inactive draft.
    await setPublication(errorKey, graph, true);
    return n.errorHandler.id;
  };
  try {
    if (
      typeof send !== 'function' ||
      bindings.environment !== 'dev' ||
      bindings.projectId !== 'pHvQjDmjxVZ3KQLT' ||
      bindings.instanceUrl !== 'https://muhhammedsayed.app.n8n.cloud' ||
      (state.scope !== undefined && state.scope !== 'incremental') ||
      !Array.isArray(n.events)
    )
      fail('CONFIG');
    if (phase === 'inventory') {
      if (Object.keys(n.snapshots).length || n.pending || n.machine.pending) fail('INVENTORY_EXISTS');
      // Complete the six allocated metadata reads before reporting drift. Full
      // DTOs remain in encrypted coordinator state, never in this receipt.
      for (const key of originals) {
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
      for (const key of originals) {
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
      checkpoint({ action: 'inventory_verified', workflowIds: originals.map((key) => n.current[key].id) });
    } else if (phase === 'machine') {
      if (!n.inventoryComplete || n.pending || n.machine.pending || n.machine.rebound)
        fail('RECONCILIATION_REQUIRED');
      await changeMachine(false);
    } else if (phase === 'stage') {
      if (!n.inventoryComplete || n.pending || n.machine.pending) fail('RECONCILIATION_REQUIRED');
      if (incremental) {
        if (n.stageComplete || n.published) fail('RECONCILIATION_REQUIRED');
        const plan = approvedPlan();
        const handlerId = await ensureOwnedErrorHandler();
        const transport = { audience: state.deployment?.audience, credential: machine };
        n.staged['WF-00'] = withManualOrchestratorEntry(
          buildNativeOrchestrator(bindings, transport, plan, handlerId),
        );
        n.staged['WF-10'] = buildNativeCollector(bindings, transport, 'vimeo', handlerId);
        n.staged['WF-11'] = buildNativeCollector(bindings, transport, 'instagram', handlerId);
        n.staged['WF-19'] = buildNativeCallback(bindings, transport, handlerId);
        for (const key of originals) await save(key, n.staged[key].workflow, 'staged');
        n.stageComplete = true;
        receipt.errorWorkflow = { key: errorKey, ...n.errorHandler.current };
      } else if (Object.keys(n.staged).length) {
        if (
          !n.stageComplete ||
          n.published ||
          n.publishAttemptClosedVersion !== n.current['WF-19']?.versionId ||
          n.staged['WF-19']?.workflow.nodes.find((node) => node.name === closedFoundationDispatch.name)
            ?.disabled === true ||
          bindings.workflowRefs['SUB-FINISH']?.id !== closedFoundationDispatch.target
        )
          fail('RECONCILIATION_REQUIRED');
        // One fixed metadata read establishes the exact unpublished dependency
        // before saving only the already-owned rejected callback definition.
        const dependencyDto = await request(
          'GET',
          '/api/v1/workflows/' + closedFoundationDispatch.target + '?excludePinnedData=true',
        );
        const dependency = workflowMetadata(dependencyDto, 'SUB-FINISH', bindings);
        n.foundationDependency = {
          key: 'SUB-FINISH',
          id: dependency.id,
          versionId: dependency.versionId,
          active: dependency.active,
          activeVersionId: dependency.activeVersionId,
          evidence: 'native_dependency_metadata_only',
          activationDiagnostic: 'not_exposed_by_workflow_get',
        };
        receipt.foundationDependency = structuredClone(n.foundationDependency);
        if (dependency.active || dependency.activeVersionId !== null) fail('DEPENDENCY_PUBLISHED');
        const corrected = withoutClosedFoundationDispatch(n.staged['WF-19']);
        await save('WF-19', corrected.workflow, 'closed_foundation_dispatch_disabled');
        n.staged['WF-19'] = corrected;
        receipt.closedFoundationDispatch = { ...closedFoundationDispatch, disabled: true };
      } else {
        const transport = { audience: state.deployment?.audience, credential: machine };
        for (const [key, kind] of [
          ['WF-10', 'vimeo'],
          ['WF-11', 'instagram'],
        ])
          n.staged[key] = withManualCollectorEntry(
            buildNativeCollector(bindings, transport, kind),
            state.selection?.[kind],
          );
        n.staged['WF-19'] = withoutClosedFoundationDispatch(
          extendNativeCallback(bindings, transport, {
            key: 'WF-19',
            id: bindings.workflowRefs['WF-19'].id,
            versionId: n.snapshots['WF-19'].versionId,
            workflow: {
              ...body(n.snapshots['WF-19']),
              active: false,
              tags: n.snapshots['WF-19'].tags,
              pinData: {},
            },
          }),
        );
        for (const key of keys) await save(key, n.staged[key].workflow, 'staged');
        n.stageComplete = true;
        receipt.closedFoundationDispatch = { ...closedFoundationDispatch, disabled: true };
      }
    } else if (phase === 'cohort') {
      if (
        !incremental ||
        !n.stageComplete ||
        !n.published ||
        !n.machine.rebound ||
        n.pending ||
        n.machine.pending
      )
        fail('RECONCILIATION_REQUIRED');
      const plan = approvedPlan(),
        cohort = state.cohort;
      if (
        !object(cohort) ||
        Object.keys(cohort).length !== 2 ||
        !Array.isArray(cohort.account_ids) ||
        new Set(cohort.account_ids).size !== cohort.account_ids.length
      )
        fail('SELECTION');
      const choices = {
        'history-pair': {
          kind: 'vimeo',
          count: 2,
          allowed: historicalVimeoPair,
          bounds: { mode: 'backfill', max_pages: 2, page_size: 5, results_limit: 5, max_actor_starts: 2 },
        },
        cursor: {
          kind: 'vimeo',
          count: 1,
          allowed: plan.vimeo_account_ids,
          bounds: { mode: 'backfill', max_pages: 2, page_size: 20, results_limit: 5, max_actor_starts: 2 },
        },
        'daily-vimeo': {
          kind: 'vimeo',
          count: 1,
          allowed: state.selection.vimeo,
          bounds: { mode: 'daily', max_pages: 1, page_size: 20, results_limit: 20, max_actor_starts: 1 },
        },
        'daily-instagram': {
          kind: 'instagram',
          count: 1,
          allowed: state.selection.instagram,
          bounds: { mode: 'daily', max_pages: 1, page_size: 5, results_limit: 5, max_actor_starts: 2 },
        },
      };
      const selected = choices[cohort.key];
      if (
        !selected ||
        cohort.account_ids.length !== selected.count ||
        cohort.account_ids.some((id) => !selected.allowed.includes(id))
      )
        fail('SELECTION');
      const handler = await read(errorKey);
      unchanged(handler.metadata, n.current[errorKey]);
      if (!handler.metadata.active || handler.metadata.activeVersionId !== handler.metadata.versionId)
        fail('DRIFT');
      const key = selected.kind === 'vimeo' ? 'WF-10' : 'WF-11';
      const graph = withManualCollectorEntry(
        buildNativeCollector(
          bindings,
          { audience: state.deployment?.audience, credential: machine },
          selected.kind,
          n.errorHandler.id,
        ),
        cohort.account_ids,
        selected.bounds,
      );
      n.staged[key] = graph;
      await save(key, graph.workflow, 'cohort_staged');
      receipt.cohort = {
        key: cohort.key,
        workflowKey: key,
        ...n.current[key],
        input: graph.manualEntry.input,
      };
    } else if (phase === 'publish') {
      if (!n.stageComplete || !n.machine.rebound || n.pending || n.machine.pending || n.published) fail();
      const before = await read('WF-19');
      unchanged(before.metadata, n.current['WF-19']);
      if (before.metadata.active || before.metadata.activeVersionId !== null) fail('DRIFT');
      if (
        n.publishAttemptClosedVersion === before.metadata.versionId ||
        (incremental && n.closedPublication?.['WF-19'] === before.metadata.versionId)
      )
        fail('PUBLISH_ATTEMPT_CLOSED');
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
    } else if (phase === 'readback') {
      if (
        (!n.stageComplete && !incremental) ||
        (incremental && !n.inventoryComplete) ||
        n.machine.pending ||
        (n.pending && !incremental && (n.pending.key !== 'WF-19' || n.pending.action !== 'publish')) ||
        !/^[a-f0-9]{40}$/.test(state.sourceHead ?? '')
      )
        fail();
      if (incremental && n.pending?.action === 'create' && !n.errorHandler) fail('CREATE_OUTCOME_UNKNOWN');
      const managed = incremental && n.errorHandler ? [...originals, errorKey] : originals;
      // Three read-only requests, including after a rejected or lost publish
      // response. Never retry publication while reconciling its outcome.
      const actual = {};
      for (const key of managed) actual[key] = await read(key);
      const pending = n.pending;
      let reconciledPublication = null;
      for (const key of managed) {
        const after = actual[key];
        const before = n.current[key];
        if (incremental && pending?.key === key) {
          const target = pending.action === 'restored' ? n.snapshots[key] : n.staged[key]?.workflow;
          if (pending.action === 'create') {
            if (
              key !== errorKey ||
              after.metadata.active ||
              after.metadata.activeVersionId !== null ||
              after.metadata.versionId !== pending.savedVersionId ||
              hash(after.dto) !== pending.targetHash ||
              !sameBody(after.dto, target)
            )
              fail('DRIFT');
            n.snapshots[key] = structuredClone(after.dto);
          } else if (['publish', 'unpublish'].includes(pending.action)) {
            unchanged(pending.before, before);
            const active = after.metadata.active;
            verifyPublication(after, before, n.staged[key], active);
            reconciledPublication = active ? 'published' : 'not_active';
            if (pending.action === 'publish' && !active) {
              (n.closedPublication ??= {})[key] = before.versionId;
            }
          } else {
            if (
              !target ||
              after.metadata.active ||
              after.metadata.activeVersionId !== null ||
              !sameBody(after.dto, target) ||
              (pending.savedVersionId && after.metadata.versionId !== pending.savedVersionId) ||
              !isDeepStrictEqual(after.metadata.tags, before.tags) ||
              !isDeepStrictEqual(after.metadata.readonlySettings, before.readonlySettings)
            )
              fail('DRIFT');
          }
          continue;
        }
        if (incremental) {
          unchanged(after.metadata, before);
          continue;
        }
        if (key !== 'WF-19' || !pending) {
          unchanged(after.metadata, before);
          continue;
        }
        unchanged(pending.before, before);
        if (!after.metadata.active && after.metadata.activeVersionId === null) {
          unchanged(after.metadata, before);
          reconciledPublication = 'not_active';
        } else {
          if (
            !after.metadata.active ||
            after.metadata.versionId !== before.versionId ||
            after.metadata.activeVersionId !== before.versionId ||
            after.metadata.graphHash !== before.graphHash ||
            !isDeepStrictEqual(after.metadata.tags, before.tags) ||
            !isDeepStrictEqual(after.metadata.readonlySettings, before.readonlySettings) ||
            !object(after.dto.activeVersion) ||
            after.dto.activeVersion.workflowId !== before.id ||
            after.dto.activeVersion.versionId !== before.versionId ||
            !sameBody(
              { ...after.dto.activeVersion, name: after.dto.name, settings: after.dto.settings },
              n.staged[key].workflow,
            )
          )
            fail('DRIFT');
          reconciledPublication = 'published';
        }
      }
      // Validation completes before private DTO fields can enter an export.
      // The graph is the exact acknowledged source-bound definition; users,
      // native response extras, static data and execution/pinned data are omitted.
      const directory = join(repo, 'milestones/M04-collectors-vimeo-instagram/evidence');
      const exports = managed.map((key) => {
        const { dto, metadata } = actual[key];
        return {
          filename: 'native-saved-' + key + '.json',
          record: {
            key,
            id: metadata.id,
            versionId: metadata.versionId,
            active: metadata.active,
            activeVersionId: metadata.activeVersionId,
            sourceHead: state.sourceHead,
            graphHash: metadata.graphHash,
            evidence: 'native_saved_definition_only',
            ...(incremental
              ? {
                  definitionOrigin:
                    n.staged[key] && sameBody(dto, n.staged[key].workflow)
                      ? 'maintained_m04_source'
                      : 'captured_baseline',
                }
              : {}),
            workflow: {
              name: dto.name,
              nodes: structuredClone(dto.nodes),
              connections: structuredClone(dto.connections),
              settings: structuredClone(dto.settings),
              tags: structuredClone(metadata.tags),
              pinData: {},
            },
          },
        };
      });
      for (const entry of exports) {
        let filename = join(directory, entry.filename);
        if (
          existsSync(filename) &&
          !isDeepStrictEqual(JSON.parse(readFileSync(filename, 'utf8')), entry.record)
        ) {
          // A later known native version is new evidence. Preserve the prior
          // actual saved export rather than replacing its historical receipt.
          entry.filename = 'native-saved-' + entry.record.key + '.' + entry.record.versionId + '.json';
          filename = join(directory, entry.filename);
        }
        if (existsSync(filename)) unchanged(JSON.parse(readFileSync(filename, 'utf8')), entry.record);
      }
      mkdirSync(directory, { recursive: true });
      for (const entry of exports) {
        const filename = join(directory, entry.filename);
        if (!existsSync(filename))
          writeFileSync(filename, JSON.stringify(entry.record, null, 2) + '\n', { flag: 'wx' });
      }
      if (pending) {
        const key = incremental ? pending.key : 'WF-19';
        n.current[key] = actual[key].metadata;
        if (key === errorKey) n.errorHandler.current = actual[key].metadata;
        if (key === 'WF-19')
          n.published = incremental ? actual[key].metadata.active : reconciledPublication === 'published';
        if (!incremental && !n.published) n.publishAttemptClosedVersion = pending.before.versionId;
        completeIntent();
        checkpoint({
          action: incremental ? 'mutation_readback' : 'publish_readback',
          outcome: reconciledPublication,
          ...actual[key].metadata,
        });
      }
      receipt.exports = exports.map(({ filename, record }) => ({
        filename,
        key: record.key,
        id: record.id,
        versionId: record.versionId,
        active: record.active,
        graphHash: record.graphHash,
        sourceHead: record.sourceHead,
      }));
      receipt.publicationReadback = reconciledPublication;
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
        for (const key of originals) {
          if (n.current[key].graphHash === hash(n.snapshots[key])) {
            const fresh = await read(key);
            unchanged(fresh.metadata, n.current[key]);
            continue;
          }
          await save(key, n.snapshots[key], 'restored');
        }
        if (incremental && n.errorHandler) await setPublication(errorKey, n.staged[errorKey], false);
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
        'PUBLISH_ATTEMPT_CLOSED',
        'DEPENDENCY_PUBLISHED',
        'SELECTION',
        'CREATE_OUTCOME_UNKNOWN',
      ].map((code) => 'M04_NATIVE_' + code),
    );
    receipt.status = 'blocked';
    receipt.code = fixed.has(error?.message) ? error.message : 'M04_NATIVE_RECONCILIATION_REQUIRED';
    receipt.needsReconciliation = true;
    checkpoint({ action: 'blocked', phase, code: receipt.code });
  }
  receipt.workflows = [...originals, ...(incremental && n.errorHandler ? [errorKey] : [])]
    .filter((key) => n.current[key])
    .map((key) => ({ key, ...n.current[key] }));
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
