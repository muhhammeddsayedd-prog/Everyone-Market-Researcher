import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import {
  createFoundationRetentionProposal,
  createFoundationApprovedRetentionPolicy,
  assertFoundationApprovedRetentionPolicy,
  applyFoundationApprovedRetentionSettings,
  foundationNativeEvidencePaths,
} from './foundation-retention-proposal.mjs';

function fixture() {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  return {
    bindings,
    records: Object.keys(bindings.workflowRefs).map((key) =>
      JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
    ),
  };
}
const blocked = /^Error: FOUNDATION_RETENTION_PROPOSAL_BLOCKED$/;

test('proposal is immutable, unapproved and limited to exact25 saved identities', () => {
  const f = fixture();
  const before = JSON.stringify(f);
  const p = createFoundationRetentionProposal(f);
  assert.equal(p.kind, 'proposed_owned_retention_exception');
  assert.equal(p.approved, false);
  assert.equal(p.hostedActionsPerformed, false);
  assert.equal(p.executionAllowed, false);
  assert.equal(p.nativeExecutionCeiling, 120);
  assert.equal(p.instanceDefaultsChanged, false);
  assert.equal(p.scope, 'retention_fields_only');
  assert.equal(p.workflows.length, 25);
  assert.equal(new Set(p.workflows.map((w) => w.id)).size, 25);
  for (const w of p.workflows) {
    const pin = foundationRuntimeCheckpoint.workflows[w.key];
    assert.equal(w.id, pin.id);
    assert.equal(w.checkpointVersionId, pin.versionId);
    assert.equal(w.checkpointRecordHash, pin.recordHash);
    assert.equal(Object.isFrozen(w.proposed), true);
    assert.equal(Object.hasOwn(w, 'body'), false);
    assert.equal(Object.hasOwn(w, 'settings'), false);
  }
  assert.equal(Object.isFrozen(p), true);
  assert.equal(JSON.stringify(f), before);
});

test('exact21 nonmanual and5 manual policies overlap only atWF91; progress stays false', () => {
  const p = createFoundationRetentionProposal(fixture());
  const all = p.workflows.filter((w) => w.proposed.saveDataSuccessExecution === 'all');
  const manual = p.workflows.filter((w) => w.proposed.saveManualExecutions);
  assert.equal(all.length, 21);
  assert.deepEqual(
    manual.map((w) => w.key).sort(),
    ['WF-00', 'WF-99', 'WF-91', 'SUB-INGEST', 'SUB-COST'].sort(),
  );
  assert.deepEqual(
    all.filter((w) => w.proposed.saveManualExecutions).map((w) => w.key),
    ['WF-91'],
  );
  for (const w of p.workflows) {
    assert.equal(w.proposed.saveExecutionProgress, false);
    assert.equal(w.proposed.saveDataErrorExecution, w.proposed.saveDataSuccessExecution);
    assert.deepEqual(Object.keys(w.proposed).sort(), Object.keys(w.baseline).sort());
    assert.deepEqual(
      w.changedFields,
      Object.keys(w.proposed).filter((k) => w.proposed[k] !== w.baseline[k]),
    );
    assert.deepEqual(w.baseline, {
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
      saveExecutionProgress: false,
    });
  }
});

test('no settings outside the four retention fields can enter a delta', () => {
  const p = createFoundationRetentionProposal(fixture());
  const allowed = new Set([
    'saveDataSuccessExecution',
    'saveDataErrorExecution',
    'saveManualExecutions',
    'saveExecutionProgress',
  ]);
  for (const w of p.workflows) {
    assert.deepEqual(Object.keys(w.baseline), [...allowed]);
    assert.deepEqual(Object.keys(w.proposed), [...allowed]);
    assert.equal(
      w.changedFields.every((k) => allowed.has(k)),
      true,
    );
    assert.equal(w.otherSettingsUnchanged, true);
  }
  assert.equal(p.privacy.fullIntermediatePayloadsStored, true);
  assert.equal(p.privacy.errorsStored, true);
  assert.equal(p.privacy.metadataOnlyStorage, false);
  assert.equal(p.privacy.redactionPreventsStorage, false);
  assert.equal(p.closure.parentTerminalProvesChildrenClosed, false);
  assert.equal(p.closure.nativeStopProvesExternalSettlement, false);
  assert.equal(p.closure.emptyScanProvesNoDelayedErrorChild, false);
});

test('missing extra duplicate and foreign records or binding IDs are rejected', () => {
  const changes = [
    (f) => f.records.pop(),
    (f) => f.records.push(structuredClone(f.records[0])),
    (f) => {
      f.records[1] = structuredClone(f.records[0]);
    },
    (f) => {
      f.records[1].id = f.records[0].id;
    },
    (f) => {
      f.records[0].key = 'WF-unowned';
    },
    (f) => {
      delete f.bindings.workflowRefs['WF-00'];
    },
    (f) => {
      f.bindings.workflowRefs['WF-unowned'] = { id: 'unowned', name: 'unowned' };
    },
    (f) => {
      f.bindings.workflowRefs['WF-00'].id = f.bindings.workflowRefs['WF-99'].id;
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    assert.throws(() => createFoundationRetentionProposal(f), blocked);
  }
});

test('changed checkpoint source version project name settings and ambiguous input are rejected', () => {
  const changes = [
    (f) => {
      f.records[0].versionId = 'changed';
    },
    (f) => {
      f.records[0].workflow.settings.saveExecutionProgress = true;
    },
    (f) => {
      f.records[0].stagedSourceHash = '0'.repeat(64);
    },
    (f) => {
      f.records[0].projectId = 'another-project';
    },
    (f) => {
      f.bindings.workflowRefs['WF-00'].name = 'unreviewed-name';
    },
    (f) => {
      f.bindings.runtimeVersion = '2.43.6';
    },
    (f) => {
      f.approved = true;
    },
    (f) => {
      f.records = null;
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    assert.throws(() => createFoundationRetentionProposal(f), blocked);
  }
});

test('native field paths distinguish payload-only links from terminal metadata', () => {
  assert.equal(foundationNativeEvidencePaths.runtimeVersion, '2.43.5');
  assert.deepEqual(foundationNativeEvidencePaths.metadata, [
    'id',
    'workflowId',
    'workflowVersionId',
    'mode',
    'status',
    'startedAt',
    'stoppedAt',
    'waitTill',
  ]);
  assert.equal(foundationNativeEvidencePaths.parent, 'data.parentExecution');
  assert.equal(
    foundationNativeEvidencePaths.onceChild,
    'data.resultData.runData[knownCallNode][runIndex].metadata.subExecution',
  );
  assert.equal(Object.isFrozen(foundationNativeEvidencePaths), true);
  assert.equal(Object.isFrozen(foundationNativeEvidencePaths.metadata), true);
});

test('owner-approved constructor pins the exact historical inventory and grants local design only', () => {
  const f = fixture();
  const p = createFoundationApprovedRetentionPolicy(f);
  assert.equal(assertFoundationApprovedRetentionPolicy(p), p);
  assert.equal(p.kind, 'approved_local_retention_design');
  assert.equal(p.approval.commit, 'eee9a277c6a7d63fffe967811c92a7fd50c15b14');
  assert.equal(
    p.approval.inventoryCanonicalSha256,
    '0cf36aed398aa58b3ad1f6d153bdf7b0d19c5f8bb2c6282a98ea52c48b7910ab',
  );
  assert.deepEqual(p.workflows, createFoundationRetentionProposal(f).workflows);
  assert.equal(p.localDesignApproved, true);
  assert.equal(p.hostedActionsAllowed, false);
  assert.equal(p.executionAllowed, false);
  assert.equal(p.privacy.fullIntermediatePayloadsStored, true);
  assert.equal(p.privacy.noSecretStorageProven, false);
  assert.throws(() => assertFoundationApprovedRetentionPolicy(structuredClone(p)), blocked);
  assert.throws(() => createFoundationApprovedRetentionPolicy({ ...f, approved: true }), blocked);
  const original = { errorWorkflow: 'fixed-error-id', availableInMCP: true, executionTimeout: 42 };
  const next = applyFoundationApprovedRetentionSettings(p, 'WF-91', original);
  assert.deepEqual(next, {
    ...original,
    saveDataSuccessExecution: 'all',
    saveDataErrorExecution: 'all',
    saveManualExecutions: true,
    saveExecutionProgress: false,
  });
  assert.deepEqual(original, { errorWorkflow: 'fixed-error-id', availableInMCP: true, executionTimeout: 42 });
  assert.throws(() => applyFoundationApprovedRetentionSettings(p, 'unowned', original), blocked);
});
