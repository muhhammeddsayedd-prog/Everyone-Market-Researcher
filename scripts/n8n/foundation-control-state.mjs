import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';

const journals = new WeakSet();
const budgets = new WeakMap();
const budgetOwners = new WeakMap();
const id = (v) => typeof v === 'string' && /^[1-9][0-9]{0,19}$/.test(v);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fields = new Set([
  'event',
  'batchId',
  'caseId',
  'executionId',
  'workflowId',
  'key',
  'workflowKey',
  'versionId',
  'bodyHash',
  'mode',
  'status',
  'createdAt',
  'startedAt',
  'stoppedAt',
  'waitTill',
  'observedAt',
  'nativeParent',
  'nativeChildren',
  'sourceNode',
  'sourceRun',
  'sourceLocation',
  'parentExecutionId',
  'parentWorkflowId',
  'shouldResume',
  'ordinal',
  'at',
  'kind',
  'state',
  'deleteAcknowledged',
  'absenceVerified',
  'residual',
  'intentAt',
  'nativeExecutions',
  'executionIds',
  'traceparent',
  'gatewayRequests',
  'providerRuns',
  'transportRequests',
  'pending',
  'settled',
  'physicalErasureVerified',
  'expectedCleanupAt',
  'followUpOwner',
  'privacyChecked',
  'transportClosed',
  'nativeGatewayRequests',
  'requestId',
  'operation',
  'errorDispatchExpected',
  'missingNativeChildCalls',
  'targetWorkflowId',
  'nativeProviderCallback',
  'apifyRunId',
  'eventType',
  'nativeExecutionId',
  'runId',
  'accountId',
  'windowId',
  'gatewayRequestIds',
  'providerRunIds',
  'transportSettled',
  'providerTerminals',
  'wireStatus',
  'finishedAt',
  'costUsd',
  'costParityVerified',
]);
const fail = () => {
  throw Error('FOUNDATION_CONTROL_STATE_BLOCKED');
};
function freeze(v) {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
function safe(v, depth = 0) {
  if (depth > 6) fail();
  if (v === null || typeof v === 'boolean') return;
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return;
  if (typeof v === 'string' && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v)) return;
  if (Array.isArray(v) && v.length <= 120) {
    v.forEach((x) => safe(x, depth + 1));
    return;
  }
  if (!object(v) || Object.keys(v).some((k) => !fields.has(k))) fail();
  Object.values(v).forEach((x) => safe(x, depth + 1));
}
export function createFoundationControlJournal({ durableAppend, previousEvents = [] }) {
  if (typeof durableAppend !== 'function' || !Array.isArray(previousEvents) || previousEvents.length > 8000)
    fail();
  const rowCheck = (row) => {
    if (!object(row) || typeof row.event !== 'string' || !/^[a-z_]{1,64}$/.test(row.event)) fail();
    safe(row);
  };
  const rows = previousEvents.map((row) => {
    rowCheck(row);
    return freeze(structuredClone(row));
  });
  let stopped = false;
  const journal = Object.freeze({
    get rows() {
      return Object.freeze([...rows]);
    },
    append(row) {
      if (stopped || rows.length >= 8000) fail();
      rowCheck(row);
      const copy = freeze(structuredClone(row));
      try {
        const result = durableAppend(copy);
        if (result !== undefined) {
          if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
          fail();
        }
      } catch {
        stopped = true;
        fail();
      }
      rows.push(copy);
    },
  });
  journals.add(journal);
  return journal;
}
export function assertFoundationControlJournal(journal) {
  if (!journals.has(journal) || !Object.isFrozen(journal)) fail();
  return journal;
}

// One shared lifetime counter for MCP starts and private execution API operations.
// It replaces416; it never consumes/replenishes the separate512 runtime counter.
export function createFoundationControlBudget({ journal, now = Date.now, deadlineAt }) {
  assertFoundationControlJournal(journal);
  if (!Number.isFinite(deadlineAt) || typeof now !== 'function') fail();
  if (budgets.has(journal)) {
    const old = budgets.get(journal);
    if (old.deadlineAt !== deadlineAt) fail();
    return old.budget;
  }
  const kinds = new Set([
    'details',
    'start',
    'metadata',
    'full',
    'workflow',
    'discovery',
    'stop',
    'delete',
    'absence',
    'webhook_start',
  ]);
  const prior = journal.rows.filter((r) => r.event === 'control_request_intent');
  const ownedWorkflow = (value) =>
    Object.values(foundationRuntimeCheckpoint.workflows).some((w) => w.id === value);
  const context = (row) => {
    if (
      !kinds.has(row.kind) ||
      (row.workflowId !== undefined && !ownedWorkflow(row.workflowId)) ||
      (row.executionId !== undefined && !id(row.executionId)) ||
      (row.kind === 'metadata' && !id(row.executionId))
    )
      fail();
  };
  if (prior.length > 2048 || prior.some((r, i) => r.ordinal !== i + 1)) fail();
  prior.forEach(context);
  let count = prior.length,
    stopped = count > 2048;
  const polls = new Map();
  for (const row of prior)
    if (row.kind === 'metadata') {
      polls.set(row.executionId, (polls.get(row.executionId) ?? 0) + 1);
      if (polls.get(row.executionId) > 8) fail();
    }
  const budget = Object.freeze({
    admit({ kind, workflowId, executionId } = {}) {
      if (stopped || !kinds.has(kind) || count >= 2048 || now() >= deadlineAt) fail();
      context({ kind, workflowId, executionId });
      if (kind === 'metadata' && (!id(executionId) || (polls.get(executionId) ?? 0) >= 8)) fail();
      const row = {
        event: 'control_request_intent',
        ordinal: ++count,
        kind,
        ...(workflowId ? { workflowId } : {}),
        ...(executionId ? { executionId } : {}),
        at: new Date(now()).toISOString(),
      };
      try {
        journal.append(row);
      } catch {
        stopped = true;
        fail();
      }
      if (now() >= deadlineAt) {
        stopped = true;
        fail();
      }
      if (kind === 'metadata') polls.set(executionId, (polls.get(executionId) ?? 0) + 1);
    },
    snapshot: () => Object.freeze({ attempts: count, maximum: 2048, stopped, deadlineAt }),
  });
  budgets.set(journal, { budget, deadlineAt });
  budgetOwners.set(budget, { journal, deadlineAt });
  return budget;
}

export function assertFoundationControlBudget(budget, { journal, deadlineAt } = {}) {
  const owner = budgetOwners.get(budget);
  if (
    !owner ||
    !Object.isFrozen(budget) ||
    (journal !== undefined && owner.journal !== journal) ||
    (deadlineAt !== undefined && owner.deadlineAt !== deadlineAt)
  )
    fail();
  return budget;
}
