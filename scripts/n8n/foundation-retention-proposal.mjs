import { createHash } from 'node:crypto';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';

// Keep this pure inventory independent of the runtime plan that consumes it.
const runtimeHash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function freezeRuntimeValue(v) {
  if (v !== null && typeof v === 'object') {
    for (const child of Object.values(v)) freezeRuntimeValue(child);
    Object.freeze(v);
  }
  return v;
}

// Proposal only. Importing or calling this module performs no I/O and supplies
// no execution, settings-update, deletion, credential or network adapter.
const manualKeys = ['WF-00', 'WF-99', 'WF-91', 'SUB-INGEST', 'SUB-COST'];
const manualOnlyKeys = ['WF-00', 'WF-99', 'SUB-INGEST', 'SUB-COST'];
const keys = Object.keys(foundationRuntimeCheckpoint.workflows);
const fields = [
  'saveDataSuccessExecution',
  'saveDataErrorExecution',
  'saveManualExecutions',
  'saveExecutionProgress',
];
const approvedPolicies = new WeakSet();
export const foundationRetentionDesignApproval = freezeRuntimeValue({
  commit: 'eee9a277c6a7d63fffe967811c92a7fd50c15b14',
  inventoryPath: 'milestones/M03-n8n-foundation/evidence/m03-c01-retention-proposal-20261019.json',
  inventoryFileSha256: '772699066c08a96d30415173cb238cc07b3bd475fb3fdd4bc7a587771860ff82',
  inventoryCanonicalSha256: '0cf36aed398aa58b3ad1f6d153bdf7b0d19c5f8bb2c6282a98ea52c48b7910ab',
  scope: 'local_runtime_design_only',
});
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, names) =>
  object(v) && Object.keys(v).length === names.length && names.every((k) => Object.hasOwn(v, k));
const blocked = () => {
  throw Error('FOUNDATION_RETENTION_PROPOSAL_BLOCKED');
};

// Pinned native source: public DTO fields are entity metadata; child/parent
// links exist only in run data, which includeData=false does not return.
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/executions.public.controller.ts#L445-L518
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts#L403-L521
export const foundationNativeEvidencePaths = freezeRuntimeValue({
  runtimeVersion: '2.43.5',
  metadata: ['id', 'workflowId', 'workflowVersionId', 'mode', 'status', 'startedAt', 'stoppedAt', 'waitTill'],
  parent: 'data.parentExecution',
  onceChild: 'data.resultData.runData[knownCallNode][runIndex].metadata.subExecution',
  eachChild: 'data.resultData.runData[knownCallNode][runIndex].data.main[output][item].metadata.subExecution',
  continuedFailureChild:
    'data.resultData.runData[knownCallNode][runIndex].data.main[output][item].metadata.subExecution',
  waitingChild: 'data.resultData.runData[knownCallNode][runIndex].metadata.waitingChildExecutionIds',
});

/**
 * A reviewable exception inventory, never a native settings replacement body.
 * Future runtime error links/MCP visibility and every other setting must remain
 * intact when these four field deltas are reviewed/applied separately.
 *
 * Native save behavior (including manual-mode precedence and waiting state):
 * https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/execution-lifecycle/execution-lifecycle-hooks.ts#L594-L704
 */
export function createFoundationRetentionProposal(input) {
  try {
    if (!exact(input, ['bindings', 'records'])) blocked();
    const { bindings, records } = input;
    parseN8nBindings(bindings);
    if (
      bindings.projectId !== foundationRuntimeCheckpoint.projectId ||
      bindings.runtimeVersion !== '2.43.5' ||
      !exact(bindings.workflowRefs, keys) ||
      !Array.isArray(records) ||
      records.length !== 25 ||
      keys.length !== 25
    )
      blocked();
    const byKey = new Map();
    const ids = new Set();
    for (const record of records) {
      if (!object(record) || !Object.hasOwn(foundationRuntimeCheckpoint.workflows, record.key)) blocked();
      const pin = foundationRuntimeCheckpoint.workflows[record.key];
      if (
        byKey.has(record.key) ||
        ids.has(record.id) ||
        record.id !== pin.id ||
        record.versionId !== pin.versionId ||
        runtimeHash(record) !== pin.recordHash ||
        record.stagedSourceHash !== pin.stagedSourceHash ||
        record.projectId !== foundationRuntimeCheckpoint.projectId ||
        record.active !== false ||
        record.activeVersionId !== null ||
        record.definitionProfile !== 'inactive_native_staging' ||
        bindings.workflowRefs[record.key]?.id !== pin.id ||
        bindings.workflowRefs[record.key]?.name !== record.workflow.name
      )
        blocked();
      byKey.set(record.key, record);
      ids.add(record.id);
    }
    const workflows = keys.map((key) => {
      const record = byKey.get(key);
      if (!record) blocked();
      const baseline = Object.fromEntries(fields.map((f) => [f, record.workflow.settings[f]]));
      if (
        baseline.saveDataSuccessExecution !== 'none' ||
        baseline.saveDataErrorExecution !== 'none' ||
        baseline.saveManualExecutions !== false ||
        baseline.saveExecutionProgress !== false
      )
        blocked();
      const nonmanual = !manualOnlyKeys.includes(key);
      const proposed = {
        saveDataSuccessExecution: nonmanual ? 'all' : 'none',
        saveDataErrorExecution: nonmanual ? 'all' : 'none',
        saveManualExecutions: manualKeys.includes(key),
        saveExecutionProgress: false,
      };
      return {
        key,
        id: record.id,
        checkpointVersionId: record.versionId,
        checkpointRecordHash: foundationRuntimeCheckpoint.workflows[key].recordHash,
        baseline,
        proposed,
        changedFields: fields.filter((f) => baseline[f] !== proposed[f]),
        otherSettingsUnchanged: true,
      };
    });
    return freezeRuntimeValue({
      version: 1,
      kind: 'proposed_owned_retention_exception',
      approved: false,
      executionAllowed: false,
      hostedActionsPerformed: false,
      scope: 'retention_fields_only',
      checkpointReceipt: foundationRuntimeCheckpoint.observedReceipt,
      projectId: foundationRuntimeCheckpoint.projectId,
      nativeExecutionCeiling: 120,
      instanceDefaultsChanged: false,
      workflows,
      privacy: {
        fullIntermediatePayloadsStored: true,
        errorsStored: true,
        metadataOnlyStorage: false,
        redactionPreventsStorage: false,
        noSecretStorageProven: false,
        note: 'Native all/manual retention stores intermediate run data, errors and workflow snapshots. Read-time redaction and a safe final node do not sanitize stored history. Separate approval and actual synthetic stored-data privacy checks are required before live use.',
      },
      closure: {
        parentTerminalProvesChildrenClosed: false,
        nativeStopProvesExternalSettlement: false,
        emptyScanProvesNoDelayedErrorChild: false,
        note: 'Require exact native identity/version/time/status and child-parent linkage. Error handlers can start after parent termination; missing or unlinked expected children remain unknown. Cancellation or deletion is not external settlement.',
      },
      restoration:
        'Restore the exact four baseline fields on every owned workflow only after execution/child/provider closure; this module supplies no restoration action or deletion adapter.',
    });
  } catch {
    blocked();
  }
}

// The owner's decision approves implementation of this one inventory. It is
// not a credential, runtime admission, hosted-settings or execution approval.
// There is deliberately no caller-controlled approval boolean or policy delta.
export function createFoundationApprovedRetentionPolicy(input) {
  const proposal = createFoundationRetentionProposal(input);
  if (runtimeHash(proposal) !== foundationRetentionDesignApproval.inventoryCanonicalSha256) blocked();
  const policy = freezeRuntimeValue({
    version: 1,
    kind: 'approved_local_retention_design',
    approval: foundationRetentionDesignApproval,
    localDesignApproved: true,
    hostedActionsAllowed: false,
    executionAllowed: false,
    workflows: proposal.workflows,
    privacy: proposal.privacy,
  });
  approvedPolicies.add(policy);
  return policy;
}

export function assertFoundationApprovedRetentionPolicy(policy) {
  if (!object(policy) || !approvedPolicies.has(policy) || !Object.isFrozen(policy)) blocked();
  return policy;
}

export function applyFoundationApprovedRetentionSettings(policy, key, settings) {
  assertFoundationApprovedRetentionPolicy(policy);
  const row = policy.workflows.find((w) => w.key === key);
  if (!row || !object(settings)) blocked();
  return { ...settings, ...row.proposed };
}
