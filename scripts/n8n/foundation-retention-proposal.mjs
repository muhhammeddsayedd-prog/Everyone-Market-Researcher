import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { freezeRuntimeValue, runtimeHash } from './foundation-runtime-plan.mjs';

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
