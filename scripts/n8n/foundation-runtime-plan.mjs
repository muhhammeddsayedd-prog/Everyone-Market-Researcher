import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import {
  foundationRuntimeCheckpoint,
  foundationRuntimeNativeReadonlyPin,
  foundationRuntimeGraphHash,
} from './foundation-runtime-checkpoint.mjs';
import { graphBody, inactiveNativeStagingGraph } from './foundation-bind.mjs';
import { materializeFoundationAcceptanceCase } from '../../n8n/foundation/materialize-acceptance-case.mjs';
import { buildFoundationGatewayWorkflows } from '../../n8n/foundation/build-foundation-gateway.mjs';
import { buildFoundationNativeDomainProbe } from './foundation-live-domain-probe.mjs';
import { foundationProjectVerifiedContinuationRestoredBaselineVersions } from './foundation-live-project-verified-continuation.mjs';
import {
  createFoundationApprovedRetentionPolicy,
  assertFoundationApprovedRetentionPolicy,
  applyFoundationApprovedRetentionSettings,
} from './foundation-retention-proposal.mjs';

const blocked = () => {
  throw Error('FOUNDATION_RUNTIME_PLAN_BLOCKED');
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const checkedPlans = new WeakSet();
const checkedCases = new WeakSet();
const checkedBodies = new WeakMap();
const functionalRows = new WeakMap();
export const runtimeHash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function freezeRuntimeValue(v) {
  if (v !== null && typeof v === 'object') {
    for (const child of Object.values(v)) freezeRuntimeValue(child);
    Object.freeze(v);
  }
  return v;
}
freezeRuntimeValue(foundationRuntimeCheckpoint);
const initialAudience = 'https://everyone-market-researcher-8f7sa5lox-muhammed-abdelrahman.vercel.app';
const machine = foundationRuntimeCheckpoint.machine;
const keys = Object.keys(foundationRuntimeCheckpoint.workflows);
export const foundationRuntimePublishOrder = freezeRuntimeValue([
  'SUB-NOTIFY',
  'WF-90',
  'WF-30',
  'WF-70',
  'WF-80',
  'SUB-FINISH',
  'WF-19',
]);
const functionalKeys = ['SUB-NOTIFY', 'WF-90', 'SUB-START', 'SUB-FINISH', 'WF-30', 'WF-70', 'WF-19', 'WF-99'];
const historicalWindows = [
  '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
  'eda4fae1-1e19-47db-81b8-beac1a4ed883',
  '3c46c791-e140-4eb9-890a-eecfa251f65e',
  '4c602549-2c42-4ec3-9328-714d7cb66a77',
  'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
  'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
  '4000f48f-7426-4606-a01e-a6e49aa207d2',
];
// One functional scope replaces attempt profiles. This public validation is not
// authentication: the fresh SQL provision and all live ownership checks remain.
export function assertFoundationFunctionalScope(
  scope,
  { sourceCommitSha = scope?.sourceCommitSha, windowId = scope?.windowId } = {},
) {
  const carryFloor = { management: 1661, control: 1464, combined: 3125, vercel: 288 };
  if (
    !exact(scope, [
      'projectRef',
      'projectId',
      'windowId',
      'sourceCommitSha',
      'caps',
      'carried',
      'restoredBaselineVersions',
    ]) ||
    scope.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    scope.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    typeof scope.windowId !== 'string' ||
    typeof scope.sourceCommitSha !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(scope.windowId) ||
    historicalWindows.includes(scope.windowId) ||
    scope.windowId !== windowId ||
    !/^[a-f0-9]{40}$/.test(scope.sourceCommitSha) ||
    scope.sourceCommitSha !== sourceCommitSha ||
    !isDeepStrictEqual(scope.caps, { management: 2176, control: 3584, combined: 5312, vercel: 400 }) ||
    !exact(scope.carried, Object.keys(carryFloor)) ||
    Object.entries(carryFloor).some(
      ([key, floor]) =>
        !Number.isSafeInteger(scope.carried[key]) ||
        scope.carried[key] < floor ||
        scope.carried[key] > scope.caps[key],
    ) ||
    scope.carried.combined !== scope.carried.management + scope.carried.control ||
    scope.carried.vercel > scope.carried.management
  )
    blocked();
  const { rows, versions } = functionalRestoration();
  if (!isDeepStrictEqual(scope.restoredBaselineVersions, versions)) blocked();
  functionalRows.set(scope, rows);
  return freezeRuntimeValue(scope);
}
function functionalRestoration() {
  const pinned = (name, sha) => {
    const bytes = readFileSync(
      new URL('../../milestones/M03-n8n-foundation/evidence/' + name, import.meta.url),
    );
    if (createHash('sha256').update(bytes).digest('hex') !== sha) blocked();
    return JSON.parse(bytes);
  };
  const actual = pinned(
    'functional-collection-attempt-20261025.json',
    '5067c7893fb50d2bb135ae0c5f521c54af2881033c66d86c9f5d230e3bc1b5f0',
  );
  const restored = pinned(
    'functional-restored-workflows-projection-20261025.json',
    '2cb4c60ce75920a487633612663e32e1b83a5cab8baac0453d07cfc383a251bb',
  );
  const wf00 = pinned(
    'wf00-restore-verified-20261023.json',
    '32184be54a4b36f250fa026ece00f295c94c6149b2af5fb682bfb769f683f9ec',
  );
  const closedWindow = '4000f48f-7426-4606-a01e-a6e49aa207d2';
  const runtime = actual.publicJournal.rows
    .filter((row) => row.kind === 'functional_runtime' && row.windowId === closedWindow)
    .map((row) => row.row);
  const finalReadbacks = runtime.slice(-26, -1);
  if (
    actual.scope.windowId !== closedWindow ||
    actual.outcome.all25BaselineDefinitionsRestoredInactive !== true ||
    actual.outcome.windowClosed !== true ||
    actual.outcome.machineBindingRestored !== true ||
    actual.outcome.credentialBearingChildClosed !== true ||
    actual.outcome.wrapperNativeExit !== 0 ||
    restored.derivation.windowId !== closedWindow ||
    restored.derivation.sourceCommitSha !== actual.sourceCommitSha ||
    restored.derivation.runtimePlanHash !== runtime[0]?.planHash ||
    restored.derivation.restoreComplete !== true ||
    restored.derivation.runtimeRequests !== 145 ||
    restored.derivation.finalReadbackCount !== 25 ||
    runtime.at(-1)?.event !== 'restore_complete' ||
    !actual.publicJournal.rows.some(
      (row) => row.kind === 'functional_closed' && row.windowId === closedWindow,
    ) ||
    !actual.publicJournal.rows.some(
      (row) =>
        row.kind === 'functional_resource_restoration' &&
        row.windowId === closedWindow &&
        row.windowClosed === true &&
        row.runtimeRestored === true &&
        row.previewCleaned === true,
    ) ||
    finalReadbacks.length !== 25 ||
    restored.restored.length !== 25 ||
    wf00.currentExport.recordHash !== foundationRuntimeCheckpoint.workflows['WF-00'].recordHash ||
    wf00.currentExport.workflowDefinitionUnchanged !== true
  )
    blocked();
  const versions = Object.fromEntries(
    restored.restored.map((row, index) => {
      const readback = finalReadbacks[index];
      if (
        !keys.includes(row.key) ||
        row.workflowId !== foundationRuntimeCheckpoint.workflows[row.key].id ||
        !/^[a-f0-9-]{36}$/.test(row.restoredVersionId) ||
        row.activeVersionId !== null ||
        row.publishedHash !== null ||
        readback.event !== 'request' ||
        readback.number !== 121 + index ||
        readback.method !== 'GET' ||
        readback.path !== '/api/v1/workflows/' + row.workflowId + '?excludePinnedData=true'
      )
        blocked();
      return [row.key, row.restoredVersionId];
    }),
  );
  if (Object.keys(versions).length !== 25) blocked();
  return { rows: restored.restored, versions };
}
export function foundationFunctionalBaselineVersions() {
  return freezeRuntimeValue(functionalRestoration().versions);
}
export function createFoundationRuntimeSetupOutput(v) {
  if (
    !exact(v, [
      'version',
      'projectId',
      'branch',
      'sourceCommitSha',
      'deploymentId',
      'audience',
      'environment',
      'readyState',
      'protection',
      'protectionVerified',
      'protectionTransportVerified',
      'sqlAudienceBindingVerified',
    ]) ||
    v.version !== 1 ||
    v.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    v.branch !== 'm03-n8n-foundation' ||
    !/^[a-f0-9]{40}$/.test(v.sourceCommitSha) ||
    !/^dpl_[A-Za-z0-9]{1,100}$/.test(v.deploymentId) ||
    typeof v.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v.audience) ||
    v.audience === initialAudience ||
    v.environment !== 'preview' ||
    v.readyState !== 'READY' ||
    v.protection !== 'all_except_custom_domains' ||
    v.protectionVerified !== true ||
    v.protectionTransportVerified !== true ||
    v.sqlAudienceBindingVerified !== true
  )
    blocked();
  // This validates a future trusted setup port's readback, not Vercel or SQL itself.
  return freezeRuntimeValue(structuredClone(v));
}
function bodyFor(record) {
  return graphBody({ key: record.key, workflow: { ...record.workflow, active: false } });
}
// Source-only baseline for preflight; constructing it grants no runtime plan,
// deployment, publication or mutation authority.
export function createFoundationRuntimeBaseline(input) {
  const { bindings, records } = input;
  if (
    !object(bindings) ||
    bindings.projectId !== foundationRuntimeCheckpoint.projectId ||
    bindings.runtimeVersion !== '2.43.5' ||
    !object(bindings.workflowRefs) ||
    Object.keys(bindings.workflowRefs).length !== 25 ||
    !Array.isArray(records) ||
    records.length !== 25
  )
    blocked();
  const byKey = new Map();
  for (const record of records) {
    const pinned = foundationRuntimeCheckpoint.workflows[record.key];
    if (
      !pinned ||
      byKey.has(record.key) ||
      record.id !== pinned.id ||
      record.versionId !== pinned.versionId ||
      runtimeHash(record) !== pinned.recordHash ||
      record.stagedSourceHash !== pinned.stagedSourceHash ||
      record.projectId !== foundationRuntimeCheckpoint.projectId ||
      record.active !== false ||
      record.activeVersionId !== null ||
      record.definitionProfile !== 'inactive_native_staging' ||
      bindings.workflowRefs[record.key]?.id !== pinned.id ||
      bindings.workflowRefs[record.key]?.name !== record.workflow.name
    )
      blocked();
    byKey.set(record.key, record);
    if (Object.hasOwn(record, 'nativeReadonlySettings')) foundationRuntimeNativeReadonlyPin(record);
  }
  // Validate every canonical source record before applying only the qualified
  // native versions left by the separately reconciled restoration.
  if (input.functionalScope !== undefined && Object.hasOwn(input, 'projectVerifiedContinuationProof'))
    blocked();
  const restoredVersions =
    input.functionalScope !== undefined
      ? assertFoundationFunctionalScope(input.functionalScope).restoredBaselineVersions
      : Object.hasOwn(input, 'projectVerifiedContinuationProof')
        ? foundationProjectVerifiedContinuationRestoredBaselineVersions(
            input.projectVerifiedContinuationProof,
          )
        : null;
  return freezeRuntimeValue(
    keys.map((key) => {
      const record = byKey.get(key);
      if (!record) blocked();
      if (
        input.functionalScope &&
        functionalRows.get(input.functionalScope).find((row) => row.key === key)?.targetGraphHash !==
          foundationRuntimeGraphHash(bodyFor(record))
      )
        blocked();
      return {
        key,
        id: record.id,
        versionId: restoredVersions?.[key] ?? record.versionId,
        body: bodyFor(record),
        tags: structuredClone(record.workflow.tags),
        ...(Object.hasOwn(record, 'nativeReadonlySettings')
          ? { nativeReadonlySettings: structuredClone(record.nativeReadonlySettings) }
          : {}),
      };
    }),
  );
}
function runtimeBody(graph, setup, errorLink, retentionPolicy) {
  const body = graphBody(graph);
  for (const n of body.nodes) {
    if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
    if (n.credentials?.httpCustomAuth?.id === machine.id) {
      if (n.parameters.url !== setup.audience + '/api/internal/n8n/foundation') blocked();
    }
  }
  if (JSON.stringify(body).includes(initialAudience)) blocked();
  body.settings = applyFoundationApprovedRetentionSettings(retentionPolicy, graph.key, body.settings);
  body.settings.availableInMCP = false;
  if (graph.key !== 'WF-90' && errorLink)
    body.settings.errorWorkflow = foundationRuntimeCheckpoint.workflows['WF-90'].id;
  else delete body.settings.errorWorkflow;
  return body;
}
export function createFoundationRuntimePlan(input) {
  const { bindings, transport, records, activeWindowId = foundationRuntimeCheckpoint.windowId } = input;
  let { setup } = input;
  setup = createFoundationRuntimeSetupOutput(setup);
  const functional =
    input.functionalScope === undefined
      ? null
      : assertFoundationFunctionalScope(input.functionalScope, {
          sourceCommitSha: setup.sourceCommitSha,
          windowId: activeWindowId,
        });
  if (
    (!functional &&
      ![
        'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        'eda4fae1-1e19-47db-81b8-beac1a4ed883',
        '3c46c791-e140-4eb9-890a-eecfa251f65e',
        '4c602549-2c42-4ec3-9328-714d7cb66a77',
        'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
        'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
      ].includes(activeWindowId)) ||
    !object(bindings) ||
    bindings.projectId !== foundationRuntimeCheckpoint.projectId ||
    bindings.runtimeVersion !== '2.43.5' ||
    !object(bindings.workflowRefs) ||
    Object.keys(bindings.workflowRefs).length !== 25 ||
    !Array.isArray(records) ||
    records.length !== 25 ||
    !object(transport) ||
    transport.audience !== initialAudience ||
    transport.windowId !== foundationRuntimeCheckpoint.windowId ||
    JSON.stringify(transport.credential) !==
      JSON.stringify({ id: machine.id, name: machine.name, type: machine.type })
  )
    blocked();
  const baseline = createFoundationRuntimeBaseline(input);
  const continuationProof = input.projectVerifiedContinuationProof;
  if (
    !functional &&
    ([
      '4c602549-2c42-4ec3-9328-714d7cb66a77',
      'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
      'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
    ].includes(activeWindowId) ||
      Object.hasOwn(input, 'projectVerifiedContinuationProof')) &&
    (continuationProof?.windowId !== activeWindowId ||
      continuationProof?.sourceCommitSha !== setup.sourceCommitSha)
  )
    blocked();
  const byKey = new Map(records.map((record) => [record.key, record]));
  const retentionPolicy = createFoundationApprovedRetentionPolicy({ bindings, records });
  const oldTransport = {
    audience: initialAudience,
    windowId: transport.windowId,
    credential: structuredClone(transport.credential),
  };
  const newTransport = { ...oldTransport, windowId: activeWindowId, audience: setup.audience };
  for (const graph of buildFoundationGatewayWorkflows(bindings, oldTransport)) {
    const staged = inactiveNativeStagingGraph(graph, foundationRuntimeCheckpoint.workflows['WF-90'].id);
    if (staged.metadata.stagedSourceHash !== byKey.get(graph.key)?.stagedSourceHash) blocked();
  }
  const compiled = new Map(buildFoundationGatewayWorkflows(bindings, newTransport).map((g) => [g.key, g]));
  const runtime = (functional ? functionalKeys : keys).map((key) => ({
    key,
    id: byKey.get(key).id,
    body: runtimeBody(compiled.get(key), setup, true, retentionPolicy),
    tags: structuredClone(byKey.get(key).workflow.tags),
  }));
  const step = (kind, key, body) => ({ kind, key, ...(body ? { body } : {}) });
  const setupSteps = [
    step('save', 'SUB-NOTIFY', runtimeBody(compiled.get('SUB-NOTIFY'), setup, false, retentionPolicy)),
    step('publish', 'SUB-NOTIFY'),
    step('save', 'WF-90', runtimeBody(compiled.get('WF-90'), setup, false, retentionPolicy)),
    step('publish', 'WF-90'),
    // Changing settings on a published workflow can be live. Remove its temporary
    // publication before changing the error link; setup allows no execution.
    step('unpublish', 'SUB-NOTIFY'),
    step('save', 'SUB-NOTIFY', runtime.find((r) => r.key === 'SUB-NOTIFY').body),
    step('publish', 'SUB-NOTIFY'),
    ...runtime
      .filter((r) => !['SUB-NOTIFY', 'WF-90'].includes(r.key))
      .map((r) => step('save', r.key, r.body)),
    ...(functional
      ? foundationRuntimePublishOrder.filter((key) => key !== 'WF-80')
      : foundationRuntimePublishOrder
    )
      .filter((key) => !['SUB-NOTIFY', 'WF-90'].includes(key))
      .map((key) => step('publish', key)),
  ];
  const plan = {
    version: 1,
    kind: 'proposed_finite_runtime_transition',
    hostedActionsPerformed: false,
    retentionPolicy,
    windowId: activeWindowId,
    projectId: foundationRuntimeCheckpoint.projectId,
    setup,
    oldAudience: initialAudience,
    machine: structuredClone(machine),
    machinePatch: {
      isPartialData: true,
      data: { allowedHttpRequestDomains: 'domains', allowedDomains: new URL(setup.audience).hostname },
    },
    machineRestore: {
      isPartialData: true,
      data: { allowedHttpRequestDomains: 'domains', allowedDomains: new URL(initialAudience).hostname },
    },
    baseline,
    runtime,
    bindings: structuredClone(bindings),
    transport: newTransport,
    publishKeys: [...foundationRuntimePublishOrder].filter((key) => !functional || key !== 'WF-80'),
    ...(functional ? { functionalScope: freezeRuntimeValue(structuredClone(functional)) } : {}),
    setupSteps,
    maximumManagementRequests: 512,
    concurrencyBoundary:
      'No compare-and-swap: public graph PUT forceSave=true. An exclusive operator window is required; any observed version/content/publication drift stops before writing. A pending ambiguous mutation is never replayed.',
  };
  plan.planHash = runtimeHash(plan);
  freezeRuntimeValue(plan);
  checkedPlans.add(plan);
  checkedBodies.set(
    plan,
    new Set(
      [
        ...baseline.filter((row) => !functional || [...functionalKeys, 'SUB-INGEST'].includes(row.key)),
        ...runtime,
        ...setupSteps.filter((s) => s.kind === 'save'),
      ].map((r) => runtimeHash(r.body)),
    ),
  );
  return plan;
}
export function assertFoundationRuntimePlan(plan) {
  // The factory deeply freezes every value before branding. Rehashing its large
  // immutable graphs on every bounded request adds work without extra integrity.
  if (
    !object(plan) ||
    !checkedPlans.has(plan) ||
    !Object.isFrozen(plan) ||
    typeof plan.planHash !== 'string' ||
    plan.kind !== 'proposed_finite_runtime_transition' ||
    plan.maximumManagementRequests !== 512
  )
    blocked();
  assertFoundationApprovedRetentionPolicy(plan.retentionPolicy);
  return plan;
}
export function runtimeManagementCounts(plan, caseCount = 0) {
  assertFoundationRuntimePlan(plan);
  if (!Number.isSafeInteger(caseCount) || caseCount < 0 || caseCount > 32) blocked();
  const setup = 25 + 5 + plan.setupSteps.length * 3;
  const restore = plan.publishKeys.length * 3 + (plan.functionalScope ? 9 : 25) * 3 + 3 + 25;
  const finalAudit = plan.functionalScope ? 0 : 25;
  return {
    setup,
    restore,
    finalAudit,
    caseDrafts: caseCount * 3,
    nominalTotal: setup + restore + finalAudit + caseCount * 3,
    maximum: 512,
  };
}
export function foundationRuntimePreparationInventory(caseCount = 23) {
  if (!Number.isSafeInteger(caseCount) || caseCount < 0 || caseCount > 32) blocked();
  const publishActions = foundationRuntimePublishOrder.length + 1;
  const setup = 25 + 5 + (26 + publishActions + 1) * 3;
  const restore = foundationRuntimePublishOrder.length * 3 + 25 * 3 + 3 + 25;
  return freezeRuntimeValue({
    kind: 'source_only_runtime_preparation',
    hostedActionsPerformed: false,
    checkpointReceipt: 'da8fd3',
    workflowCount: 25,
    canonicalErrorLinks: 24,
    uniquePublishedWorkflowKeys: [...foundationRuntimePublishOrder],
    publishActions,
    bootstrapUnpublishActions: 1,
    graphWrites: 26,
    setup,
    restore,
    finalAudit: 25,
    caseCount,
    caseDrafts: caseCount * 3,
    nominalTotal: setup + restore + 25 + caseCount * 3,
    maximumManagementAttempts: 512,
    immutableSetupOutputRequired: true,
    historyExcluded: { foundationProvisioningAttempts: 188, privateIncidentGets: 35 },
    nativeExecutionControlNotProvided: true,
  });
}
export function materializeFoundationRuntimeCase(plan, caseId, options = {}) {
  assertFoundationRuntimePlan(plan);
  if (plan.functionalScope && !['smoke.first', 'sub.ingest.replay_a'].includes(caseId)) blocked();
  const graph = materializeFoundationAcceptanceCase(plan.bindings, plan.transport, caseId, options);
  const body = graphBody(graph);
  body.settings = applyFoundationApprovedRetentionSettings(plan.retentionPolicy, graph.key, body.settings);
  body.settings.availableInMCP = true;
  for (const n of body.nodes) {
    if (
      n.type !== 'n8n-nodes-base.manualTrigger' &&
      (/Trigger$/.test(n.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.form'].includes(n.type))
    )
      n.disabled = true;
  }
  if (
    body.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger' && n.disabled !== true).length !== 1 ||
    body.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger' && n.disabled !== true)
  )
    blocked();
  const draft = freezeRuntimeValue({
    kind: 'proposed_owned_runtime_case_draft',
    caseId,
    key: graph.key,
    id: foundationRuntimeCheckpoint.workflows[graph.key].id,
    body,
    bodyHash: runtimeHash(body),
    publish: false,
    managementRequests: 3,
    sourceOnly: true,
    executionAuthorized: false,
  });
  checkedCases.add(draft);
  checkedBodies.get(plan).add(draft.bodyHash);
  return draft;
}
export function materializeFoundationRuntimeDomainProbe(plan) {
  assertFoundationRuntimePlan(plan);
  const settings = { ...plan.runtime.find((r) => r.key === 'WF-99').body.settings, availableInMCP: true };
  delete settings.errorWorkflow;
  const graph = buildFoundationNativeDomainProbe({ runtimeAudience: plan.setup.audience, settings });
  const body = graphBody({ ...graph, workflow: { ...graph.workflow, active: false } });
  body.settings = applyFoundationApprovedRetentionSettings(plan.retentionPolicy, 'WF-99', body.settings);
  const draft = freezeRuntimeValue({
    kind: 'proposed_owned_runtime_case_draft',
    caseId: 'control.machine_domain',
    key: 'WF-99',
    id: foundationRuntimeCheckpoint.workflows['WF-99'].id,
    body,
    bodyHash: runtimeHash(body),
    publish: false,
    managementRequests: 3,
    sourceOnly: true,
    executionAuthorized: false,
  });
  checkedCases.add(draft);
  checkedBodies.get(plan).add(draft.bodyHash);
  return draft;
}
export function assertFoundationRuntimeCaseDraft(draft) {
  if (!object(draft) || !checkedCases.has(draft)) blocked();
}
export function foundationRuntimeBodyAllowed(plan, body) {
  assertFoundationRuntimePlan(plan);
  if (!object(body)) return false;
  const value = structuredClone(body);
  if (value.settings?.errorWorkflow === 'DEFAULT') delete value.settings.errorWorkflow;
  return checkedBodies.get(plan).has(runtimeHash(value));
}
