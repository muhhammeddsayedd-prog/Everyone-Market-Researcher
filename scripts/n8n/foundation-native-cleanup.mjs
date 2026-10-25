import {
  assertFoundationNativeReader,
  assertFoundationNativeReceipt,
  assertFoundationTechnical16CleanupQualification,
  claimFoundationTechnical16CleanupQualification,
  assertFoundationTechnical22CleanupQualification,
  claimFoundationTechnical22CleanupQualification,
} from './foundation-native-reader.mjs';
import {
  assertFoundationNativeClosure,
  assertFoundationControlJournal,
} from './foundation-execution-control.mjs';

// Local orchestration only. Neither a transport nor private credentials are
// supplied here. Native records are the only deletion target; application,
// provider, workflow, fixture and journal data are outside this interface.
const states = new WeakMap();
const cleanupReceipts = new WeakMap();
const terminal = new Set(['success', 'error', 'canceled', 'crashed']);
const outcomes = new Set([
  'native_record_deleted',
  'cleanup_ambiguous',
  'record_remaining',
  'cleanup_blocked',
]);
const positiveId = (v) =>
  typeof v === 'string' &&
  /^[1-9][0-9]{0,15}$/.test(v) &&
  Number.isSafeInteger(Number(v)) &&
  String(Number(v)) === v;
const blocked = () => {
  throw Error('FOUNDATION_NATIVE_CLEANUP_BLOCKED');
};
export function assertFoundationNativeCleanupReceipt(result, { receipt, closure } = {}) {
  const owned = cleanupReceipts.get(result);
  if (
    !owned ||
    !Object.isFrozen(result) ||
    (receipt !== undefined && owned.receipt !== receipt) ||
    (closure !== undefined && owned.closure !== closure)
  )
    blocked();
  return result;
}
const synchronousVoid = (v) => {
  if (v !== undefined) {
    if (v && typeof v.then === 'function') Promise.resolve(v).catch(() => {});
    blocked();
  }
};

function priorState(journal) {
  if (states.has(journal)) return states.get(journal);
  const rows = journal.rows;
  if (!Array.isArray(rows)) blocked();
  const entries = new Map();
  let deleteAttempts = 0,
    absenceReads = 0,
    batchId = null;
  for (const row of rows) {
    if (row.event === 'native_cleanup_intent') {
      if (
        !positiveId(row.executionId) ||
        entries.has(row.executionId) ||
        row.ordinal !== deleteAttempts + 1 ||
        typeof row.batchId !== 'string' ||
        deleteAttempts >= 120
      )
        blocked();
      if (batchId !== null && row.batchId !== batchId) blocked();
      batchId = row.batchId;
      entries.set(row.executionId, {
        executionId: row.executionId,
        workflowId: row.workflowId,
        state: 'cleanup_ambiguous',
        deleteAcknowledged: false,
        absenceVerified: false,
        residual: true,
      });
      deleteAttempts++;
    } else if (row.event === 'native_cleanup_absence_intent') {
      const entry = entries.get(row.executionId);
      if (
        !entry ||
        entry.absenceAttempted ||
        row.workflowId !== entry.workflowId ||
        row.batchId !== batchId ||
        row.ordinal !== absenceReads + 1 ||
        absenceReads >= 120
      )
        blocked();
      entry.absenceAttempted = true;
      absenceReads++;
    } else if (row.event === 'native_cleanup_result') {
      const entry = entries.get(row.executionId);
      if (
        !entry ||
        entry.resultSeen ||
        row.workflowId !== entry.workflowId ||
        row.batchId !== batchId ||
        !outcomes.has(row.state) ||
        typeof row.deleteAcknowledged !== 'boolean' ||
        typeof row.absenceVerified !== 'boolean' ||
        typeof row.residual !== 'boolean' ||
        (row.state === 'native_record_deleted'
          ? !row.deleteAcknowledged || !row.absenceVerified || row.residual
          : !row.residual)
      )
        blocked();
      Object.assign(entry, {
        state: row.state,
        deleteAcknowledged: row.deleteAcknowledged,
        absenceVerified: row.absenceVerified,
        residual: row.residual,
        resultSeen: true,
      });
    }
  }
  const state = { entries, deleteAttempts, absenceReads, batchId, busy: false, pendingCalls: 0 };
  states.set(journal, state);
  return state;
}

function safeEvidence(receipt, closure) {
  // Select only the reader's checked metadata/link projection. In particular,
  // never copy the original DTO, embedded workflow or node input/output/error.
  return {
    event: 'native_cleanup_evidence',
    batchId: closure.batchId,
    caseId: closure.caseId,
    executionId: receipt.executionId,
    workflowId: receipt.workflowId,
    key: receipt.key,
    versionId: receipt.versionId,
    bodyHash: receipt.bodyHash,
    mode: receipt.mode,
    status: receipt.status,
    createdAt: receipt.createdAt,
    startedAt: receipt.startedAt,
    stoppedAt: receipt.stoppedAt,
    waitTill: receipt.waitTill,
    observedAt: receipt.observedAt,
    nativeParent: receipt.nativeParent,
    nativeChildren: receipt.nativeChildren,
  };
}

/**
 * The branded controller closure supplies actual batch ownership, causal
 * registration and independent settlement. Terminal native status alone is
 * insufficient. The explicit journal port must synchronously flush each safe
 * row before returning undefined. Its rows retain every previous intent, so a
 * fresh adapter cannot replay an acknowledged or ambiguous DELETE.
 *
 * closureValidator is an explicit trusted unit-test port only. The normal
 * path always uses assertFoundationNativeClosure; there is no live CLI here.
 */
export function createFoundationNativeCleanup({
  reader,
  transport,
  admitControlAttempt,
  journal,
  now,
  deadlineAt,
  requestTimeoutMs = 15000,
  closureValidator = assertFoundationNativeClosure,
} = {}) {
  try {
    assertFoundationNativeReader(reader);
    assertFoundationControlJournal(journal);
    if (
      typeof transport?.request !== 'function' ||
      typeof admitControlAttempt !== 'function' ||
      typeof journal?.append !== 'function' ||
      typeof now !== 'function' ||
      !Number.isFinite(deadlineAt) ||
      !Number.isFinite(now()) ||
      now() >= deadlineAt ||
      typeof closureValidator !== 'function' ||
      !Number.isInteger(requestTimeoutMs) ||
      requestTimeoutMs < 1 ||
      requestTimeoutMs > 15000
    )
      blocked();
  } catch {
    blocked();
  }
  let state;
  try {
    state = priorState(journal);
  } catch {
    blocked();
  }
  const time = () => {
    const value = now();
    if (!Number.isFinite(value)) blocked();
    return value;
  };
  const at = () => new Date(time()).toISOString();
  const append = (row) => synchronousVoid(journal.append(Object.freeze(row)));
  const remaining = () => {
    const value = deadlineAt - time();
    if (value <= 0) blocked();
    return value;
  };
  const assertPostcloseQualification = (qualification) =>
    qualification?.kind === 'foundation_technical22_cleanup_qualification'
      ? assertFoundationTechnical22CleanupQualification(qualification, { reader })
      : assertFoundationTechnical16CleanupQualification(qualification, { reader });

  async function request(operation, receipt, qualification = null) {
    const method = operation === 'delete_ack' ? 'DELETE' : 'GET';
    const path = '/api/v1/executions/' + receipt.executionId + (method === 'GET' ? '?includeData=false' : '');
    remaining();
    const reserveWrite = () => {
      if (qualification !== null && operation === 'delete_ack') {
        assertPostcloseQualification(qualification);
        if (remaining() < 2 * requestTimeoutMs + 5000) blocked();
      }
    };
    reserveWrite();
    synchronousVoid(
      admitControlAttempt({
        kind: operation === 'delete_ack' ? 'delete' : 'absence',
        workflowId: receipt.workflowId,
        executionId: receipt.executionId,
      }),
    );
    // A durable budget ledger can advance the clock. Recheck immediately
    // before the transport boundary as well as before its asynchronous turn.
    remaining();
    reserveWrite();
    const controller = new AbortController();
    let timer;
    state.pendingCalls++;
    const work = Promise.resolve()
      .then(() => {
        remaining();
        reserveWrite();
        return transport.request({ method, path, signal: controller.signal });
      })
      .then((response) =>
        qualification === null
          ? reader.cleanupResponse({ response, receipt, operation, signal: controller.signal })
          : reader.technical16CleanupResponse({
              response,
              qualification,
              executionId: receipt.executionId,
              operation,
              signal: controller.signal,
            }),
      )
      .finally(() => {
        state.pendingCalls--;
      });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => {
          controller.abort();
          reject(Error('FOUNDATION_NATIVE_CLEANUP_BLOCKED'));
        },
        Math.min(requestTimeoutMs, remaining()),
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  async function cleanupOne({ receipt, closure, technical16 = false, technical22 = false }) {
    const postclose = technical16 || technical22;
    let full, closed;
    try {
      if (postclose) {
        closed = assertPostcloseQualification(closure);
        if (!closed.records.includes(receipt)) blocked();
        full = receipt;
      } else {
        full = assertFoundationNativeReceipt(receipt);
        closed = closureValidator(closure, { receipt });
      }
      if (
        !positiveId(full.executionId) ||
        !terminal.has(full.status) ||
        full.waitTill !== null ||
        closed?.kind !==
          (technical22
            ? 'foundation_technical22_cleanup_qualification'
            : technical16
              ? 'foundation_technical16_cleanup_qualification'
              : 'foundation_native_closure') ||
        closed.settled !== true ||
        typeof closed.batchId !== 'string' ||
        typeof closed.caseId !== 'string' ||
        closed.owner !== 'Mohamed Abdelrahman' ||
        !Array.isArray(closed.executionIds) ||
        !closed.executionIds.includes(full.executionId) ||
        (state.batchId !== null && state.batchId !== closed.batchId) ||
        state.entries.has(full.executionId) ||
        state.deleteAttempts >= 120 ||
        state.busy
      )
        blocked();
      remaining();
      if (postclose && remaining() < 2 * requestTimeoutMs + 5000) blocked();
    } catch {
      blocked();
    }
    // Acquire both the ID fence and the shared journal lock before awaiting
    // anything. Even journal failure never silently re-arms this ID.
    state.busy = true;
    state.batchId = closed.batchId;
    const entry = {
      executionId: full.executionId,
      workflowId: full.workflowId,
      state: 'cleanup_blocked',
      deleteAcknowledged: false,
      absenceVerified: false,
      residual: true,
    };
    state.entries.set(full.executionId, entry);
    let intentPersisted = false,
      absenceReadConfirmed = false;
    try {
      append(safeEvidence(full, closed));
      append({
        event: 'native_cleanup_intent',
        batchId: closed.batchId,
        caseId: closed.caseId,
        executionId: full.executionId,
        workflowId: full.workflowId,
        ordinal: state.deleteAttempts + 1,
        at: at(),
      });
      intentPersisted = true;
      state.deleteAttempts++;
      try {
        const ack = await request('delete_ack', full, postclose ? closed : null);
        entry.deleteAcknowledged =
          ack?.kind === 'foundation_native_delete_ack' &&
          ack.executionId === full.executionId &&
          ack.acknowledged === true &&
          ack.transportClosed === true &&
          ack.privacyChecked === true;
      } catch {
        // A lost acknowledgement may still have mutated native storage.
        // Exactly one read-only reconciliation is allowed; never replay it.
      }
      if (state.absenceReads < 120) {
        try {
          remaining();
          append({
            event: 'native_cleanup_absence_intent',
            batchId: closed.batchId,
            caseId: closed.caseId,
            executionId: full.executionId,
            workflowId: full.workflowId,
            ordinal: state.absenceReads + 1,
            at: at(),
          });
          state.absenceReads++;
          const absence = await request('absence', full, postclose ? closed : null);
          if (
            absence?.kind === 'foundation_native_absence' &&
            absence.executionId === full.executionId &&
            absence.transportClosed === true &&
            absence.privacyChecked === true &&
            typeof absence.absent === 'boolean'
          ) {
            absenceReadConfirmed = true;
            entry.absenceVerified = absence.absent === true;
          }
        } catch {
          // Failure/timeout/expiry remains an unresolved residual. Ingress
          // closure and runtime restoration belong to the caller's finally.
        }
      }
      entry.state = entry.deleteAcknowledged
        ? entry.absenceVerified
          ? 'native_record_deleted'
          : absenceReadConfirmed
            ? 'record_remaining'
            : 'cleanup_ambiguous'
        : 'cleanup_ambiguous';
      entry.residual = entry.state !== 'native_record_deleted';
      append({
        event: 'native_cleanup_result',
        batchId: closed.batchId,
        caseId: closed.caseId,
        executionId: full.executionId,
        workflowId: full.workflowId,
        state: entry.state,
        deleteAcknowledged: entry.deleteAcknowledged,
        absenceVerified: entry.absenceVerified,
        residual: entry.residual,
        at: at(),
      });
    } catch {
      entry.state = intentPersisted ? 'cleanup_ambiguous' : 'cleanup_blocked';
      entry.residual = true;
    } finally {
      state.busy = false;
    }
    const result = Object.freeze({
      ...entry,
      followUpOwner: 'Mohamed Abdelrahman',
      expectedCleanupAt: new Date(deadlineAt).toISOString(),
      physicalErasureVerified: false,
    });
    if (!postclose) cleanupReceipts.set(result, { receipt: full, closure: closed });
    return result;
  }
  return Object.freeze({
    cleanup({ receipt, closure } = {}) {
      return cleanupOne({ receipt, closure });
    },
    async cleanupTechnical16({ qualification } = {}) {
      // This path never invokes the optional unit-test closure validator.
      // Only the real reader's fresh, single-use qualification can cross it.
      try {
        claimFoundationTechnical16CleanupQualification(qualification, { reader });
        if (
          state.busy ||
          state.entries.size !== 0 ||
          qualification.records.length !== 2 ||
          qualification.executionIds.join(',') !== '31131,31130' ||
          qualification.records.some(
            (record, index) => record.executionId !== qualification.executionIds[index],
          )
        )
          blocked();
      } catch {
        blocked();
      }
      const results = [];
      for (const receipt of qualification.records) {
        let result;
        try {
          result = await cleanupOne({ receipt, closure: qualification, technical16: true });
        } catch {
          break;
        }
        results.push(result);
        if (result.state !== 'native_record_deleted' || result.residual) break;
      }
      return Object.freeze({
        kind: 'foundation_technical16_native_cleanup',
        version: 1,
        status:
          results.length === 2 && results.every((result) => !result.residual)
            ? 'native_records_deleted'
            : 'cleanup_reconciliation_required',
        results: Object.freeze(results),
        nativeAcceptanceProven: false,
        liveClosureMinted: false,
        physicalErasureVerified: false,
      });
    },
    async cleanupTechnical22({ qualification } = {}) {
      try {
        claimFoundationTechnical22CleanupQualification(qualification, { reader });
        if (
          state.busy ||
          state.entries.size !== 0 ||
          qualification.records.length !== 1 ||
          qualification.executionIds.join(',') !== '31145' ||
          qualification.records[0].executionId !== '31145'
        )
          blocked();
      } catch {
        blocked();
      }
      const results = [];
      try {
        results.push(
          await cleanupOne({ receipt: qualification.records[0], closure: qualification, technical22: true }),
        );
      } catch {
        /* A spent claim never authorizes a replay. */
      }
      return Object.freeze({
        kind: 'foundation_technical22_native_cleanup',
        version: 1,
        status:
          results.length === 1 && !results[0].residual
            ? 'native_records_deleted'
            : 'cleanup_reconciliation_required',
        results: Object.freeze(results),
        nativeAcceptanceProven: false,
        liveClosureMinted: false,
        physicalErasureVerified: false,
      });
    },
    snapshot: () =>
      Object.freeze({
        deleteAttempts: state.deleteAttempts,
        absenceReads: state.absenceReads,
        pendingTransportCalls: state.pendingCalls,
        residuals: Object.freeze(
          [...state.entries.values()].filter((x) => x.residual).map((x) => Object.freeze({ ...x })),
        ),
        expectedCleanupAt: new Date(deadlineAt).toISOString(),
        followUpOwner: 'Mohamed Abdelrahman',
        physicalErasureVerified: false,
      }),
  });
}
