import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import {
  assertFoundationLiveRemainingContinuationProof,
  assertFoundationRemainingControlResume,
} from './foundation-live-remaining-continuation.mjs';
import {
  assertFoundationLiveStartupReplacementProof,
  assertFoundationStartupReplacementControlResume,
} from './foundation-live-startup-replacement.mjs';
import {
  assertFoundationLiveProjectVerifiedContinuationProof,
  assertFoundationProjectVerifiedContinuationControlResume,
  foundationProjectVerifiedContinuationResumeCheckpoint,
  foundationProjectVerifiedContinuationRequestCaps,
} from './foundation-live-project-verified-continuation.mjs';

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
export function createFoundationControlBudget({
  journal,
  now = Date.now,
  deadlineAt,
  remainingContinuationProof,
  startupReplacementProof,
  projectVerifiedContinuationProof,
  managementAttempts,
}) {
  assertFoundationControlJournal(journal);
  if (!Number.isFinite(deadlineAt) || typeof now !== 'function') fail();
  const remaining =
    remainingContinuationProof === undefined
      ? null
      : assertFoundationLiveRemainingContinuationProof(remainingContinuationProof, { claimed: true });
  const startup =
    startupReplacementProof === undefined
      ? null
      : assertFoundationLiveStartupReplacementProof(startupReplacementProof, { claimed: true });
  const verified =
    projectVerifiedContinuationProof === undefined
      ? null
      : assertFoundationLiveProjectVerifiedContinuationProof(projectVerifiedContinuationProof, {
          claimed: true,
        });
  if ([startup, remaining, verified].filter(Boolean).length > 1) fail();
  const continuation = verified || startup || remaining;
  if (
    continuation &&
    (continuation.deadlineAt !== deadlineAt ||
      now() < continuation.startsAt ||
      now() >= continuation.stopNewAt)
  )
    fail();
  if (budgets.has(journal)) {
    const old = budgets.get(journal);
    if (old.deadlineAt !== deadlineAt || (continuation && old.remaining !== continuation)) fail();
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
  const carriedAttempts = continuation ? continuation.carriedControlAttempts : 0;
  const verifiedCheckpoint = verified
    ? foundationProjectVerifiedContinuationResumeCheckpoint(verified)
    : null;
  const verifiedInitialControl = verifiedCheckpoint?.mainControlAttempts ?? 0;
  const requestCaps = verified
    ? foundationProjectVerifiedContinuationRequestCaps(verified)
    : { management: 512, control: 2048, combined: 2560 };
  const managementMaximum = requestCaps.management;
  const expandedManagement = [576, 640, 704, 832, 1024, 1408].includes(managementMaximum);
  let lastManagementAttempts = verifiedCheckpoint?.aggregateManagementAttempts ?? 0;
  const authoritativeManagementAttempts = () => {
    if (!expandedManagement) return 0;
    let value;
    try {
      value = managementAttempts();
    } catch {
      fail();
    }
    if (!Number.isSafeInteger(value) || value < lastManagementAttempts || value > managementMaximum) fail();
    lastManagementAttempts = value;
    return value;
  };
  if (expandedManagement && typeof managementAttempts !== 'function') fail();
  if (
    expandedManagement &&
    prior.length + carriedAttempts + authoritativeManagementAttempts() > requestCaps.combined
  )
    fail();
  if (verified)
    assertFoundationProjectVerifiedContinuationControlResume(verified, {
      deadlineAt,
      previousEvents: journal.rows,
    });
  if (startup)
    assertFoundationStartupReplacementControlResume(startup, { deadlineAt, previousEvents: journal.rows });
  if (remaining)
    assertFoundationRemainingControlResume(remaining, { deadlineAt, previousEvents: journal.rows });
  if (
    prior.length + carriedAttempts > requestCaps.control ||
    prior.some((r, i) => r.ordinal !== i + 1) ||
    (continuation &&
      (prior.length !== (verified ? verifiedInitialControl : startup ? 150 : 100) ||
        (!verified && journal.rows.length !== (startup ? 150 : 100)) ||
        (!verified && prior.some((r) => r.kind !== 'discovery' || Object.hasOwn(r, 'executionId')))))
  )
    fail();
  prior.forEach(context);
  let count = prior.length,
    stopped = count + carriedAttempts > requestCaps.control;
  const polls = new Map();
  for (const row of prior)
    if (row.kind === 'metadata') {
      polls.set(row.executionId, (polls.get(row.executionId) ?? 0) + 1);
      if (polls.get(row.executionId) > 8) fail();
    }
  const budget = Object.freeze({
    admit({ kind, workflowId, executionId } = {}) {
      if (
        stopped ||
        !kinds.has(kind) ||
        count + carriedAttempts >= requestCaps.control ||
        now() >= deadlineAt
      )
        fail();
      context({ kind, workflowId, executionId });
      if (expandedManagement) {
        try {
          if (count + carriedAttempts + authoritativeManagementAttempts() >= requestCaps.combined) {
            stopped = true;
            fail();
          }
        } catch {
          stopped = true;
          fail();
        }
      }
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
    snapshot: () =>
      Object.freeze({
        attempts: count + carriedAttempts,
        mainAttempts: count,
        carriedAttempts,
        maximum: requestCaps.control,
        stopped,
        deadlineAt,
      }),
  });
  budgets.set(journal, { budget, deadlineAt, remaining: continuation });
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
