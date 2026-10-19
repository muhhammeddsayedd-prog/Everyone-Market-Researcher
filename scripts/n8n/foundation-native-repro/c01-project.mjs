/* eslint-disable no-console -- Opt-in synthetic local CLI; no hosted or real credential values. */
// Original 19 October captured-session projection only; fixed historical counts.
if (!process.argv.includes('--original-receipts-only')) throw Error('C01_ORIGINAL_RECEIPTS_ONLY');
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.argv.includes('--inside')
  ? '/home/node/.n8n/c01-receipts'
  : resolve(import.meta.dirname, 'state/c01-receipts');
const runs = readdirSync(root)
  .filter((n) => n.startsWith('valid-'))
  .sort();
const files = runs.flatMap((r) =>
  readdirSync(resolve(root, r))
    .filter((n) => n.endsWith('.json') && !n.startsWith('workflow-'))
    .map((n) => ({ path: resolve(root, r, n), run: r, name: n })),
);
const get = (name) => {
  const x = files.find((f) => f.name === name);
  if (!x) throw Error('C01_PROJECT_MISSING');
  return JSON.parse(readFileSync(x.path));
};
const projection = (row) =>
  Object.fromEntries(
    [
      'id',
      'workflowId',
      'workflowVersionId',
      'mode',
      'status',
      'finished',
      'startedAt',
      'stoppedAt',
      'deletedAt',
      'waitTill',
    ]
      .filter((k) => row[k] !== undefined)
      .map((k) => [k, row[k]]),
  );
function runtimeFacts(data) {
  const outputs = [],
    errors = [];
  for (const [node, tasks] of Object.entries(data?.resultData?.runData ?? {}))
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i],
        base = 'resultData.runData.' + node + '[' + i + ']';
      for (const [channel, branches] of Object.entries(task.data ?? {}))
        for (let j = 0; j < branches.length; j++)
          for (let k = 0; k < (branches[j] ?? []).length; k++)
            outputs.push({
              path: base + '.data.' + channel + '[' + j + '][' + k + '].json',
              value: branches[j][k].json,
            });
      if (task.error) errors.push({ path: base + '.error', value: task.error });
    }
  if (data?.resultData?.error) errors.push({ path: 'resultData.error', value: data.resultData.error });
  const markerPaths = (marker) => {
    const found = [];
    const visit = (value, path) => {
      if (typeof value === 'string') {
        if (
          value === marker ||
          (/\.(message|description|error)$/.test(path) && value.startsWith(marker + ' [line '))
        )
          found.push(path);
        return;
      }
      if (Array.isArray(value)) return value.forEach((v, i) => visit(v, path + '[' + i + ']'));
      if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value))
          if (!['node', 'parameters', 'jsCode', 'workflowData', 'stack'].includes(k))
            visit(v, path + '.' + k);
    };
    for (const o of outputs) visit(o.value, o.path);
    for (const e of errors)
      for (const key of ['message', 'description', 'context', 'cause'])
        if (e.value?.[key] !== undefined) visit(e.value[key], e.path + '.' + key);
    return found;
  };
  return {
    markerPaths,
    safeFinal: outputs.some((o) => o.value?.checkpointOnly === true),
    rawError: errors.some((e) => typeof e.value?.message === 'string'),
  };
}
const cases = [
  'none-success',
  'manual-retention-output',
  'manual-retention-caught-failure',
  'manual-retention-uncaught-failure',
  'detached-final',
  'timeout-final',
  'same-workflow-second-native-id',
  'wait-resume-final',
  'proposal-success-pair',
  'proposal-error-pair',
  'proposal-wait-resume-pair',
  'proposal-automatic-error-child',
].map((name) => {
  const value = get(name + '.json'),
    snapshot = value.snapshot;
  const rootId = String(
    value.executionId ?? snapshot.entities.find((e) => e.workflowId === value.parent.id).id,
  );
  const entries = snapshot.data.map((r) => ({ id: String(r.executionId), data: r.decodedData }));
  const childLinks = entries.flatMap(({ id, data }) =>
    Object.entries(data?.resultData?.runData ?? {}).flatMap(([node, runs]) =>
      runs.flatMap((run, index) =>
        run.metadata?.subExecution
          ? [
              {
                producerExecutionId: id,
                producerPath: 'resultData.runData.' + node + '[' + index + '].metadata.subExecution',
                executionId: run.metadata.subExecution.executionId,
                workflowId: run.metadata.subExecution.workflowId,
              },
            ]
          : [],
      ),
    ),
  );
  const parentLinks = entries
    .filter((r) => r.data?.parentExecution)
    .map(({ id, data }) => ({
      executionId: id,
      producerPath: 'data.parentExecution',
      parentExecutionId: data.parentExecution.executionId,
      parentWorkflowId: data.parentExecution.workflowId,
      shouldResume: data.parentExecution.shouldResume,
    }));
  const ownParentLinks = parentLinks.filter((link) => String(link.parentExecutionId) === rootId);
  const associated = new Set([
    rootId,
    ...ownParentLinks.map((link) => String(link.executionId)),
    ...childLinks
      .filter((link) => link.producerExecutionId === rootId)
      .map((link) => String(link.executionId)),
  ]);
  const facts = runtimeFacts(entries.find((e) => e.id === rootId)?.data);
  return {
    name,
    rootExecutionId: rootId,
    nativeMetadata: snapshot.entities.filter((e) => associated.has(String(e.id))).map(projection),
    publicRootMetadataStatus: value.metadata?.status ?? null,
    publicRootWorkflowVersionId: value.metadata?.data?.workflowVersionId ?? null,
    nativeChildLinks: childLinks.filter((link) => associated.has(link.producerExecutionId)),
    nativeParentLinks: ownParentLinks,
    candidateWorkflowScan: {
      scope: 'isolated fixture workflow IDs; historical rows are not adopted as case closure',
      candidateRows: snapshot.entities.length,
      historicalRowsExcluded: snapshot.entities.filter((e) => !associated.has(String(e.id))).map(projection),
    },
    completionBoundary:
      name === 'none-success'
        ? 'Public metadata unavailable after logical deletion; initial child parent context is not a final outcome.'
        : 'Actual local native metadata and causal links; not Cloud proof or external-work closure.',
    privacy: {
      rootIntermediateOutputRetained: facts.markerPaths('C01_CHILD_OUTPUT_SENTINEL').length > 0,
      rootThrownFailureRetained: facts.markerPaths('C01_THROWN_FAILURE_SENTINEL').length > 0,
      rootSafeFinalCheckpointRetained: facts.safeFinal,
      rawErrorsRetained: facts.rawError,
      runtimeCanaryPaths: {
        childOutput: facts.markerPaths('C01_CHILD_OUTPUT_SENTINEL'),
        thrownFailure: facts.markerPaths('C01_THROWN_FAILURE_SENTINEL'),
        automaticFailure: facts.markerPaths('C01_AUTOMATIC_FAILURE_SENTINEL'),
      },
      sourceDefinitionsExcluded: true,
      businessNodePayloadsPrinted: false,
    },
  };
});
const detached = get('detached-intermediate.json'),
  waiting = get('waiting-intermediate.json'),
  proposedWaiting = get('proposal-waiting-intermediate.json');
const waitingPrivacy = (v) => ({
  metadata: v.snapshot.entities.map(projection),
  transientPayloadPersisted: v.snapshot.data.some(
    (d) => runtimeFacts(d.decodedData).markerPaths('C01_WAITING_PAYLOAD_SENTINEL').length > 0,
  ),
  runtimeCanaryPaths: v.snapshot.data.flatMap((d) =>
    runtimeFacts(d.decodedData)
      .markerPaths('C01_WAITING_PAYLOAD_SENTINEL')
      .map((path) => ({ executionId: d.executionId, path })),
  ),
  snapshotOutputsPrinted: false,
});
const reused = get('reused-id.json');
const publicReceipt = {
  version: 1,
  status: 'actual_isolated_local_runtime_evidence_not_cloud_acceptance',
  observedAt: new Date().toISOString(),
  runtime: {
    n8n: '2.43.5',
    node: '26.7.0',
    image: 'n8nio/n8n:2.43.5',
    imageDigest: 'sha256:4fc4c67bf5fb990201a71d94c7070abf8dd0619cb8af1d059877a447f3640392',
    docker: '29.6.1',
    database: 'isolated SQLite',
    executionEntry: 'local internal REST manual; actual local public webhook for automatic Error Trigger',
    nativeRead:
      'actual local public GET executions/{id}?includeData=false plus isolated SQLite execution_entity/execution_data inspection',
    cloudProof: false,
  },
  resources: {
    cpu: 1,
    memoryMiB: 1024,
    pids: 256,
    network: 'new labeled internal Docker network; no successful outbound access',
    hostedOperations: 0,
    realCredentials: 0,
    providerCalls: 0,
    existingContainersModified: 0,
  },
  history: {
    preExecutionSchemaFailures: 3,
    initialAutomaticWebhookRegistration404: 1,
    invalidFixtureNativeExecutions: 14,
    validFixtureNativeExecutions: 24,
    totalNativeExecutions: 38,
    invalidFixtureReason:
      'synthetic ExecuteWorkflowTrigger empty declared schema; corrected to native inputSource passthrough before valid cases',
    notAcceptance: [
      'invalid first seven fixture attempts',
      'mocked adapter tests',
      'same-version local success as Cloud acceptance',
    ],
  },
  cases,
  detachedIntermediate: detached.snapshot.entities.map(projection),
  waitingNone: waitingPrivacy(waiting),
  waitingProposed: waitingPrivacy(proposedWaiting),
  reusedId: {
    first: reused.firstId,
    second: reused.secondId,
    distinct: reused.different,
    oldLookupId: reused.oldMetadata?.data?.id,
    newLookupId: reused.newMetadata?.data?.id,
  },
  privacyConclusions: [
    'Safe final output did not remove retained intermediate child output.',
    'Caught and uncaught child failures retained original native error details.',
    'Waiting executions persisted transient payload under none until resume.',
    'None deleted public terminal metadata but initial child parent context remained in logically deleted local storage; absence is not a wipe guarantee.',
    'Read-time redaction is not claimed to wipe native storage.',
  ],
  cleanup: {
    containerClosed: false,
    networkRemoved: false,
    privateRawSyntheticData: 'ignored only; no raw execution payload or credential exported to Git',
  },
};
const out = process.argv.includes('--inside')
  ? '/home/node/.n8n/c01-public-receipt.json'
  : resolve(import.meta.dirname, 'c01-public-receipt.json');
writeFileSync(out, JSON.stringify(publicReceipt, null, 2));
console.log(
  JSON.stringify({
    status: 'C01_PUBLIC_PROJECTION_READY',
    cases: cases.length,
    totalNativeExecutions: 38,
    cloudProof: false,
  }),
);
