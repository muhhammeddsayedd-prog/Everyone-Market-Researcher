// Owned M04 operations plus the isolated direct M05 YouTube/LinkedIn subset.
// The coordinator supplies private transport, ledger and encrypted persistence.
// No secret loading, workflow execution, provider request or schedule lives here.
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
import { m05RunPolicy } from '../../packages/shared/src/n8n-collector-contracts.ts';
import { node as nativeNode, edge as nativeEdge } from '../../n8n/foundation/build-foundation.mjs';
import { buildNativeYoutube } from '../../n8n/collectors/build-native-m05.mjs';
import { buildNativeLinkedIn } from '../../n8n/collectors/build-native-m05-linkedin.mjs';
import { buildNativeM05Callback } from '../../n8n/collectors/build-native-m05-callback.mjs';
import { buildM05ErrorHandler } from '../../n8n/collectors/build-native-m05-orchestration.mjs';

const keys = ['WF-10', 'WF-11', 'WF-19'];
const incrementalApprovalId = '123e88b6-5920-4e54-832a-ad6d87c22675';
const hc01ApprovalId = '1cf8406c-1142-445e-a237-6d0fd7a67b22';
const hc01Instagram = [
  '962c9c7e-aa0f-46ae-911b-3265859e0577',
  'bed82782-753f-4ba9-91ca-691ef36f75c6',
  '46149fb9-8905-4b76-9834-4b38f668a2e2',
  '2d42d451-ac9a-42ac-a879-8760d63c8108',
  '3ca3befa-abe6-4540-a389-0cf16115c581',
];
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

const m05SubsetKeys = ['WF-13', 'WF-18', 'WF-18b', 'WF-19'];
const m05SubsetRows = [
  ['df405b78-eb07-4347-af97-6b62522bab8f', 'youtube', 'C173', 'https://www.youtube.com/@aflamproductions'],
  ['3dbf4ea2-3eae-4369-89cb-85df8fcd2e03', 'youtube', 'C186', 'https://www.youtube.com/@hekka_sa'],
  [
    '21e51070-6857-4dbd-873d-3a9feba72831',
    'linkedin',
    'C000',
    'https://www.linkedin.com/company/everyonefilms/',
  ],
  [
    '22db994a-8b44-4a57-996a-60c80cd7a640',
    'linkedin',
    'C001',
    'https://www.linkedin.com/company/goodpeoplefilms/',
  ],
  [
    '258f2013-1ca6-4794-830c-6f49efbea0b2',
    'linkedin_employees',
    'C000',
    'https://www.linkedin.com/company/everyonefilms/',
  ],
];
function m05SubsetPlan(state, bindings, freshObservation = false) {
  const policy = m05RunPolicy.safeParse(state.livePolicy);
  if (
    !object(state.selection) ||
    Object.keys(state.selection).sort().join(',') !== 'linkedin,linkedin_employees,youtube' ||
    !Array.isArray(state.accountSnapshot) ||
    state.accountSnapshot.length !== 5 ||
    !policy.success ||
    policy.data.approval_id !== state.approvalId ||
    Object.hasOwn(policy.data, 'website_urls_per_account') ||
    Object.keys(policy.data.actors).sort().join(',') !==
      'harvestapi/linkedin-company-employees,harvestapi/linkedin-company-posts' ||
    Object.values(policy.data.actors).some((a) => a.billingModel !== 'PPE') ||
    !/^[a-f0-9]{40}$/.test(state.sourceHead ?? '') ||
    !object(state.collectorSelections) ||
    Object.keys(state.collectorSelections).sort().join(',') !== 'WF-13,WF-18,WF-18b'
  )
    fail('SELECTION');
  const equalIds = (a, b) => Array.isArray(a) && isDeepStrictEqual([...a].sort(), [...b].sort());
  if (
    !equalIds(
      state.accountIds,
      m05SubsetRows.map((row) => row[0]),
    )
  )
    fail('SELECTION');
  for (const platform of ['youtube', 'linkedin', 'linkedin_employees']) {
    const allowed = m05SubsetRows.filter((r) => r[1] === platform).map((r) => r[0]);
    if (!equalIds(state.selection[platform], allowed)) fail('SELECTION');
  }
  const seen = new Set();
  for (const a of state.accountSnapshot) {
    const row = m05SubsetRows.find((r) => r[0] === a?.id);
    if (
      !row ||
      seen.has(a.id) ||
      a.platform !== row[1] ||
      a.company_code !== row[2] ||
      typeof a.url !== 'string' ||
      a.url.toLowerCase().replace(/\/$/, '') !== row[3].toLowerCase().replace(/\/$/, '')
    )
      fail('SELECTION');
    seen.add(a.id);
  }
  for (const [key, platform] of [
    ['WF-13', 'youtube'],
    ['WF-18', 'linkedin'],
    ['WF-18b', 'linkedin_employees'],
  ]) {
    const selected = state.collectorSelections[key];
    if (
      !object(selected) ||
      !equalIds(selected.account_ids, state.selection[platform]) ||
      selected.env !== 'dev' ||
      (key !== 'WF-13' &&
        (selected.results_limit > policy.data.max_results_per_profile ||
          selected.max_actor_starts > policy.data.max_actor_starts))
    )
      fail('SELECTION');
  }
  if (
    ![
      state.machineBaseline?.audience,
      ...(state.deployment?.audience === undefined ? [] : [state.deployment.audience]),
    ].every(
      (v) =>
        typeof v === 'string' && /^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v),
    )
  )
    fail('CONFIG');
  const observation = state.machineBaseline?.observation;
  const recordedAt = Date.parse(observation?.recordedAt);
  const after = Date.parse(observation?.observationInterval?.after);
  const before = Date.parse(observation?.observationInterval?.before);
  if (
    !object(observation) ||
    observation.credentialId !== machine.id ||
    observation.name !== machine.name ||
    observation.projectId !== bindings.projectId ||
    observation.secretRead !== false ||
    observation.mutations !== 0 ||
    state.machineBaseline.audience !== 'https://' + observation.allowedDomains ||
    ![recordedAt, after, before].every(Number.isFinite) ||
    after > before ||
    before > recordedAt ||
    before - after > 1800000 ||
    (freshObservation && (recordedAt > Date.now() + 30000 || Date.now() - after > 1800000))
  )
    fail('CREDENTIAL_IDENTITY');
  // Exercise the actual source guards before any credential metadata request or
  // native mutation, rather than discovering invalid inputs after handler creation.
  // Before Preview exists this is offline source validation at the reviewed
  // original Machine audience, never a provisional deployment/network target.
  const transport = {
    audience: state.deployment?.audience ?? state.machineBaseline.audience,
    credential: machine,
  };
  buildNativeYoutube(bindings, transport, state.collectorSelections['WF-13']);
  buildNativeLinkedIn(bindings, transport, 'posts', state.collectorSelections['WF-18']);
  buildNativeLinkedIn(bindings, transport, 'employees', state.collectorSelections['WF-18b']);
  return {
    sourceHead: state.sourceHead,
    approvalId: state.approvalId,
    policy: policy.data,
    selection: structuredClone(state.selection),
    accountIds: [...state.accountIds].sort(),
    baselineAudience: state.machineBaseline?.audience,
    baselineObservation: {
      recordedAt: observation.recordedAt,
      observationInterval: {
        after: observation.observationInterval.after,
        before: observation.observationInterval.before,
      },
      credentialId: observation.credentialId,
      name: observation.name,
      projectId: observation.projectId,
      allowedDomains: observation.allowedDomains,
      secretRead: false,
      mutations: 0,
    },
  };
}

function m05ManualEntry(graph) {
  const init =
    graph.key === 'WF-13' ? 'Initialize fixed YouTube selection' : 'Initialize fixed LinkedIn selection';
  if (
    !['WF-13', 'WF-18', 'WF-18b'].includes(graph.key) ||
    graph.workflow.active !== false ||
    graph.workflow.nodes.filter((n) => n.name === init && n.type === 'n8n-nodes-base.code').length !== 1 ||
    graph.workflow.nodes.some((n) =>
      ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook'].includes(
        n.type,
      ),
    ) ||
    !isDeepStrictEqual(graph.workflow.connections['When called'], { main: [[nativeEdge(init)]] })
  )
    fail('CONFIG');
  // Pinned ExecuteWorkflowTrigger1.3 trigger() returns {}, with no manual emit:
  // https://raw.githubusercontent.com/n8n-io/n8n/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.ts#L219-L254
  const name = 'Manual M05 subset collection';
  graph.workflow.nodes.push(nativeNode(graph.key, name, 'manualTrigger', {}, [0, 200]));
  graph.workflow.connections[name] = { main: [[nativeEdge(init)]] };
  graph.manualEntry = { triggerNodeName: name, input: { env: 'dev' } };
  return graph;
}

/** A source-bound extension of this existing native adapter. It has no run,
 * provider or SQL port and cannot stage WF-00, WF-21 or a website account. */
async function runM05SubsetTask({ phase, state, send, bindings, repo, machineToken }) {
  const receipt = {
    phase,
    scope: 'm05-subset',
    status: 'blocked',
    code: null,
    requestCount: 0,
    needsReconciliation: false,
    websiteExcluded: false,
  };
  const handlerKey = 'WF-90-M05';
  const n = (state.native ??= {
    scope: 'm05-subset',
    snapshots: {},
    current: {},
    staged: {},
    credentials: {},
    machine: { rebound: false },
    pending: null,
    events: [],
  });
  const checkpoint = (event) => n.events.push({ ...event, observedAt: new Date().toISOString() });
  const ref = (key) => {
    if (m05SubsetKeys.includes(key)) return bindings.workflowRefs[key];
    if (
      key !== handlerKey ||
      !n.errorHandler ||
      n.errorHandler.approvalId !== n.scopePin?.approvalId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(n.errorHandler.id ?? '') ||
      Object.values(bindings.workflowRefs).some((r) => r.id === n.errorHandler.id)
    )
      fail('WORKFLOW_IDENTITY');
    return { id: n.errorHandler.id, name: 'WF-90-M05 · Collector error handler [dev]' };
  };
  const path = (key, suffix = '?excludePinnedData=true') => '/api/v1/workflows/' + ref(key).id + suffix;
  const request = async (method, url, value = null, statuses = [200]) => {
    receipt.requestCount++;
    const response = await send(method, url, value);
    if (!object(response) || !statuses.includes(response.status) || !object(response.body)) fail();
    return response.body;
  };
  const read = async (key) => {
    const dto = await request('GET', path(key));
    return {
      dto,
      metadata: workflowMetadata(dto, key, {
        ...bindings,
        workflowRefs: { ...bindings.workflowRefs, [key]: ref(key) },
      }),
    };
  };
  const save = async (key, target, action) => {
    const before = await read(key);
    unchanged(before.metadata, n.current[key]);
    if (sameBody(before.dto, target)) return;
    if (before.metadata.active || before.metadata.activeVersionId !== null) fail('DRIFT');
    const wire = body(target);
    if (!Object.hasOwn(wire.settings, 'errorWorkflow')) wire.settings.errorWorkflow = 'DEFAULT';
    n.pending = { key, action, before: before.metadata, targetHash: hash(target) };
    const saved = await request('PUT', path(key, '?publishIfActive=false'), wire);
    if (saved.id !== ref(key).id || !/^[A-Za-z0-9_-]{1,128}$/.test(saved.versionId ?? '')) fail();
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
      fail('DRIFT');
    n.current[key] = after.metadata;
    n.pending = null;
    checkpoint({ action, key, ...after.metadata });
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
  const publish = async (key, active) => {
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
    verifyPublication(after, before.metadata, n.staged[key], active);
    n.current[key] = after.metadata;
    if (key === handlerKey) n.errorHandler.current = after.metadata;
    if (key === 'WF-19') n.published = active;
    n.pending = null;
    checkpoint({ action: active ? 'published' : 'unpublished', key, ...after.metadata });
  };
  const changeMachine = async (restore) => {
    const current = credentialMetadata(
      await request('GET', '/api/v1/credentials/' + machine.id),
      machine,
      bindings,
    );
    unchanged(current, n.machine.current);
    const audience = restore ? n.scopePin.baselineAudience : n.audience;
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
  const requireReady = () => {
    if (!n.inventoryComplete || n.pending || n.machine.pending || n.restoreComplete)
      fail('RECONCILIATION_REQUIRED');
  };
  try {
    if (
      typeof send !== 'function' ||
      n.scope !== 'm05-subset' ||
      bindings.environment !== 'dev' ||
      bindings.projectId !== 'pHvQjDmjxVZ3KQLT' ||
      bindings.instanceUrl !== 'https://muhhammedsayed.app.n8n.cloud' ||
      !Array.isArray(n.events)
    )
      fail('CONFIG');
    if (!['restore', 'machine_restore'].includes(phase)) {
      const plan = m05SubsetPlan(state, bindings, phase === 'inventory' && !n.inventoryComplete);
      if (n.scopePin) unchanged(plan, n.scopePin);
      else n.scopePin = structuredClone(plan);
    } else if (!n.scopePin) fail('INVENTORY_REQUIRED');
    receipt.websiteExcluded = true;
    if (['machine', 'stage', 'publish'].includes(phase)) {
      const audience = state.deployment?.audience;
      if (
        typeof audience !== 'string' ||
        !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience)
      )
        fail('CONFIG');
      if (n.audience) unchanged(audience, n.audience);
      else n.audience = audience;
    }
    if (phase === 'inventory') {
      if (n.inventoryComplete || Object.keys(n.snapshots).length || n.pending || n.machine.pending)
        fail('INVENTORY_EXISTS');
      for (const key of m05SubsetKeys) n.snapshots[key] = structuredClone((await read(key)).dto);
      for (const [name, expected] of [
        ['machine', machine],
        ['apify', bindings.credentials.apify],
        ['youtube', bindings.credentials.youtube],
      ])
        n.credentials[name] = credentialMetadata(
          await request('GET', '/api/v1/credentials/' + expected.id),
          expected,
          bindings,
        );
      for (const key of m05SubsetKeys) {
        const dto = n.snapshots[key],
          metadata = workflowMetadata(dto, key, bindings);
        const reviewed = JSON.parse(readFileSync(join(repo, 'n8n/workflows', key + '.json'), 'utf8'));
        if (
          metadata.active ||
          metadata.activeVersionId !== null ||
          !sameBody(dto, reviewed.workflow) ||
          !isDeepStrictEqual(
            metadata.tags,
            reviewed.workflow.tags
              .map(({ id, name }) => ({ id, name }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          )
        )
          fail('DRIFT');
        n.current[key] = metadata;
      }
      n.machine.baseline = structuredClone(n.credentials.machine);
      n.machine.current = structuredClone(n.credentials.machine);
      n.inventoryComplete = true;
      checkpoint({ action: 'inventory_verified', workflowIds: m05SubsetKeys.map((k) => ref(k).id) });
    } else if (phase === 'machine') {
      requireReady();
      if (n.machine.rebound) fail();
      await changeMachine(false);
    } else if (phase === 'stage') {
      requireReady();
      // Verify every existing graph before the first new write, preserving unknown newer work.
      for (const key of m05SubsetKeys) unchanged((await read(key)).metadata, n.current[key]);
      const transport = { audience: n.audience, credential: machine };
      const handler = buildM05ErrorHandler(bindings, transport);
      handler.workflow.nodes[0].notes = 'emr-m05-subset:' + n.scopePin.approvalId;
      n.staged[handlerKey] = handler;
      if (!n.errorHandler) {
        n.pending = {
          key: handlerKey,
          action: 'create',
          targetHash: hash(handler.workflow),
          approvalId: n.scopePin.approvalId,
        };
        const created = await request(
          'POST',
          '/api/v1/workflows',
          { ...body(handler.workflow), projectId: bindings.projectId },
          [200, 201],
        );
        if (
          !/^[A-Za-z0-9_-]{1,128}$/.test(created.id ?? '') ||
          Object.values(bindings.workflowRefs).some((r) => r.id === created.id)
        )
          fail('WORKFLOW_IDENTITY');
        n.errorHandler = {
          id: created.id,
          approvalId: n.scopePin.approvalId,
          createdGraphHash: hash(handler.workflow),
        };
        n.pending.savedVersionId = created.versionId;
        const after = await read(handlerKey);
        if (
          after.metadata.active ||
          after.metadata.activeVersionId !== null ||
          after.metadata.versionId !== created.versionId ||
          !sameBody(after.dto, handler.workflow)
        )
          fail('DRIFT');
        n.snapshots[handlerKey] = structuredClone(after.dto);
        n.current[handlerKey] = after.metadata;
        n.errorHandler.current = after.metadata;
        n.pending = null;
        checkpoint({ action: 'created_owned_error_handler', key: handlerKey, ...after.metadata });
      } else {
        const current = await read(handlerKey);
        unchanged(current.metadata, n.current[handlerKey]);
        if (
          n.errorHandler.createdGraphHash !== hash(handler.workflow) ||
          !sameBody(current.dto, handler.workflow)
        )
          fail('DRIFT');
      }
      await publish(handlerKey, true);
      const selections = state.collectorSelections;
      n.staged['WF-13'] = m05ManualEntry(buildNativeYoutube(bindings, transport, selections['WF-13']));
      n.staged['WF-18'] = m05ManualEntry(
        buildNativeLinkedIn(bindings, transport, 'posts', selections['WF-18']),
      );
      n.staged['WF-18b'] = m05ManualEntry(
        buildNativeLinkedIn(bindings, transport, 'employees', selections['WF-18b']),
      );
      // Import/use the maintained callback unchanged. Website policy and account
      // exclusion make its thin branch unreachable; this does not repair it.
      n.staged['WF-19'] = buildNativeM05Callback(bindings, transport, n.errorHandler.id);
      for (const key of m05SubsetKeys) {
        n.staged[key].workflow.settings.errorWorkflow = n.errorHandler.id;
        await save(key, n.staged[key].workflow, 'staged');
      }
      n.stageComplete = true;
    } else if (phase === 'publish') {
      requireReady();
      if (!n.stageComplete || !n.machine.rebound) fail();
      await publish('WF-19', true);
    } else if (phase === 'readback') {
      if (!n.inventoryComplete || n.machine.pending) fail();
      if (n.pending?.action === 'create' && !n.errorHandler) fail('CREATE_OUTCOME_UNKNOWN');
      const managed = [...m05SubsetKeys, ...(n.errorHandler ? [handlerKey] : [])],
        actual = {};
      for (const key of managed) actual[key] = await read(key);
      for (const key of managed) {
        const after = actual[key],
          pending = n.pending;
        if (pending?.key !== key) {
          unchanged(after.metadata, n.current[key]);
          continue;
        }
        const target = pending.action === 'restored' ? n.snapshots[key] : n.staged[key]?.workflow;
        if (pending.action === 'create') {
          if (
            after.metadata.active ||
            after.metadata.activeVersionId !== null ||
            after.metadata.versionId !== pending.savedVersionId ||
            !sameBody(after.dto, target)
          )
            fail('DRIFT');
        } else if (['publish', 'unpublish'].includes(pending.action)) {
          verifyPublication(after, pending.before, n.staged[key], after.metadata.active);
        } else if (
          !target ||
          after.metadata.active ||
          after.metadata.activeVersionId !== null ||
          !sameBody(after.dto, target) ||
          (pending.savedVersionId && after.metadata.versionId !== pending.savedVersionId) ||
          !isDeepStrictEqual(after.metadata.tags, pending.before.tags) ||
          !isDeepStrictEqual(after.metadata.readonlySettings, pending.before.readonlySettings)
        )
          fail('DRIFT');
      }
      if (n.pending) {
        const pending = n.pending,
          key = pending.key,
          after = actual[key];
        if (pending.action === 'create') n.snapshots[key] = structuredClone(after.dto);
        if (pending.action === 'publish' && !after.metadata.active)
          (n.closedPublication ??= {})[key] = pending.before.versionId;
        n.current[key] = after.metadata;
        if (key === handlerKey) n.errorHandler.current = after.metadata;
        if (key === 'WF-19') n.published = after.metadata.active;
        n.pending = null;
        checkpoint({ action: 'mutation_readback', key, ...after.metadata });
      }
      const directory = join(repo, 'milestones/M05-collectors-web-youtube-linkedin/evidence');
      const exports = managed.map((key) => {
        const { dto, metadata } = actual[key];
        return {
          filename: `native-saved-${key}.${metadata.versionId}.json`,
          record: {
            key,
            ...metadata,
            sourceHead: n.scopePin.sourceHead,
            evidence: 'native_saved_definition_only',
            scope: 'm05-subset',
            websiteExcluded: true,
            workflow: {
              name: dto.name,
              nodes: structuredClone(dto.nodes),
              connections: structuredClone(dto.connections),
              settings: structuredClone(dto.settings),
              tags: metadata.tags,
              pinData: {},
            },
          },
        };
      });
      mkdirSync(directory, { recursive: true });
      for (const { filename, record } of exports) {
        const file = join(directory, filename);
        if (existsSync(file)) unchanged(JSON.parse(readFileSync(file, 'utf8')), record);
        else writeFileSync(file, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
      }
      receipt.exports = exports.map(({ filename, record }) => ({
        filename,
        key: record.key,
        id: record.id,
        versionId: record.versionId,
        active: record.active,
        graphHash: record.graphHash,
      }));
    } else if (phase === 'machine_restore') {
      if (!n.inventoryComplete || n.machine.pending) fail();
      if (n.machine.rebound) await changeMachine(true);
    } else if (phase === 'restore') {
      try {
        if (!n.inventoryComplete || n.pending || n.machine.pending) fail();
        if (n.published) await publish('WF-19', false);
        for (const key of m05SubsetKeys) await save(key, n.snapshots[key], 'restored');
        if (n.errorHandler) await publish(handlerKey, false);
        n.restoreComplete = true;
      } finally {
        if (n.machine.rebound && !n.machine.pending) await changeMachine(true);
      }
    } else fail('PHASE');
    receipt.status = 'completed';
  } catch (error) {
    const fixed = new Set(
      [
        'CONFIG',
        'PHASE',
        'SELECTION',
        'DRIFT',
        'RECONCILIATION_REQUIRED',
        'CREATE_OUTCOME_UNKNOWN',
        'WORKFLOW_IDENTITY',
        'CREDENTIAL_IDENTITY',
        'INVENTORY_REQUIRED',
        'INVENTORY_EXISTS',
        'PUBLISH_ATTEMPT_CLOSED',
      ].map((c) => 'M04_NATIVE_' + c),
    );
    receipt.code = fixed.has(error?.message) ? error.message : 'M04_NATIVE_RECONCILIATION_REQUIRED';
    receipt.needsReconciliation = true;
    if (Array.isArray(n.events)) checkpoint({ action: 'blocked', phase, code: receipt.code });
  }
  receipt.workflows = [...m05SubsetKeys, ...(n.errorHandler ? [handlerKey] : [])]
    .filter((k) => n.current[k])
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

/** Mutates only supplied private state. The coordinator durably records each
 * request intent before network activity and encrypts the inventory baseline
 * before mutation phases; pending intent is also set before injected send. */
export async function runNativeTask({ phase, state, send, bindings, repo, machineToken }) {
  if (state.scope === 'm05-subset')
    return runM05SubsetTask({ phase, state, send, bindings, repo, machineToken });
  const receipt = { phase, status: 'blocked', code: null, requestCount: 0, needsReconciliation: false };
  const hc01 = state.scope === 'hc01';
  const incremental = hc01 || state.scope === 'incremental';
  const approvalId = hc01 ? hc01ApprovalId : incrementalApprovalId;
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
      n.errorHandler.approvalId !== approvalId ||
      (hc01 && id !== 'AwxhktgJdvLXE0FZ')
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
    if (hc01) {
      if (
        state.approvalId !== hc01ApprovalId ||
        !/^[a-f0-9]{40}$/.test(state.sourceHead ?? '') ||
        !setEqual(selected?.instagram, hc01Instagram) ||
        !setEqual(selected?.vimeo, [historicalVimeoPair[0]])
      )
        fail('SELECTION');
      return { instagram_account_ids: [...selected.instagram], vimeo_account_ids: [...selected.vimeo] };
    }
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
    if (hc01) {
      if (!n.errorHandler || !n.snapshots[errorKey]) fail('INVENTORY_REQUIRED');
      const before = await read(errorKey);
      unchanged(before.metadata, n.current[errorKey]);
      if (before.metadata.active || before.metadata.activeVersionId !== null) fail('DRIFT');
      await save(errorKey, graph.workflow, 'hc01_owned_handler_staged');
      await setPublication(errorKey, graph, true);
      return n.errorHandler.id;
    }
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
      (state.scope !== undefined && !['incremental', 'hc01'].includes(state.scope)) ||
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
      if (hc01) {
        n.errorHandler = { id: 'AwxhktgJdvLXE0FZ', approvalId: hc01ApprovalId };
        const handler = await read(errorKey);
        const retained = JSON.parse(
          readFileSync(
            join(repo, 'milestones/M04-collectors-vimeo-instagram/evidence/native-saved-WF-90-M04.json'),
            'utf8',
          ),
        );
        if (
          retained.id !== n.errorHandler.id ||
          handler.metadata.active ||
          handler.metadata.activeVersionId !== null ||
          !sameBody(handler.dto, retained.workflow)
        )
          fail('DRIFT');
        n.snapshots[errorKey] = structuredClone(handler.dto);
        n.current[errorKey] = handler.metadata;
        n.errorHandler.current = handler.metadata;
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
        n.staged['WF-00'] = hc01
          ? { workflow: structuredClone(n.snapshots['WF-00']) }
          : withManualOrchestratorEntry(buildNativeOrchestrator(bindings, transport, plan, handlerId));
        n.staged['WF-10'] = hc01
          ? withManualCollectorEntry(
              buildNativeCollector(bindings, transport, 'vimeo', handlerId),
              [historicalVimeoPair[0]],
              { mode: 'backfill', max_pages: 1, page_size: 5, results_limit: 5, max_actor_starts: 1 },
            )
          : buildNativeCollector(bindings, transport, 'vimeo', handlerId);
        n.staged['WF-11'] = hc01
          ? withManualCollectorEntry(
              buildNativeCollector(bindings, transport, 'instagram', handlerId),
              [hc01Instagram[0]],
              { mode: 'daily', max_pages: 1, page_size: 5, results_limit: 30, max_actor_starts: 2 },
            )
          : buildNativeCollector(bindings, transport, 'instagram', handlerId);
        n.staged['WF-19'] = buildNativeCallback(bindings, transport, handlerId);
        for (const key of originals) {
          if (hc01 && key === 'WF-00') continue;
          await save(key, n.staged[key].workflow, 'staged');
        }
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
      const choices = hc01
        ? {
            'first-instagram': {
              kind: 'instagram',
              count: 1,
              allowed: [hc01Instagram[0]],
              bounds: { mode: 'daily', max_pages: 1, page_size: 5, results_limit: 30, max_actor_starts: 2 },
            },
            'remaining-instagram': {
              kind: 'instagram',
              count: 4,
              allowed: hc01Instagram.slice(1),
              bounds: { mode: 'daily', max_pages: 1, page_size: 5, results_limit: 30, max_actor_starts: 8 },
            },
            'recovery-instagram': {
              kind: 'instagram',
              count: 1,
              allowed: hc01Instagram,
              bounds: { mode: 'daily', max_pages: 1, page_size: 5, results_limit: 30, max_actor_starts: 2 },
            },
            'vimeo-continuation': {
              kind: 'vimeo',
              count: 1,
              allowed: [historicalVimeoPair[0]],
              bounds: { mode: 'backfill', max_pages: 1, page_size: 5, results_limit: 5, max_actor_starts: 1 },
            },
          }
        : {
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
              bounds: {
                mode: 'backfill',
                max_pages: 2,
                page_size: 20,
                results_limit: 5,
                max_actor_starts: 2,
              },
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
        if (incremental && n.errorHandler) {
          if (hc01 && !n.staged[errorKey]) {
            const fresh = await read(errorKey);
            unchanged(fresh.metadata, n.current[errorKey]);
            if (fresh.metadata.active || fresh.metadata.activeVersionId !== null) fail('DRIFT');
          } else {
            await setPublication(errorKey, n.staged[errorKey], false);
            if (hc01 && n.current[errorKey].graphHash !== hash(n.snapshots[errorKey]))
              await save(errorKey, n.snapshots[errorKey], 'hc01_owned_handler_restored');
          }
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
