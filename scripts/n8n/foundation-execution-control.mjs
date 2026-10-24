import { foundationAcceptancePlan } from '../../n8n/foundation/materialize-acceptance-case.mjs';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { assertFoundationRuntimeCaseReceipt } from './foundation-runtime-control.mjs';
import { createFoundationNativeController } from './foundation-native-controller.mjs';
export {
  createFoundationControlJournal,
  assertFoundationControlJournal,
  createFoundationControlBudget,
  assertFoundationControlBudget,
} from './foundation-control-state.mjs';
export { assertFoundationNativeClosure } from './foundation-native-controller.mjs';

// Local controller + explicit adapters, never an HTTP /run endpoint. Importing
// this module has no effects. No credential handling, data reads or network
// transport is supplied here. The caller must bind the supported MCP tools.
export const foundationControlLimits = Object.freeze({
  nativeExecutions: 120,
  mcpRequests: 2048,
  pollsPerExecution: 8,
  pollIntervalMs: 15000,
  deadlineMs: 60 * 60 * 1000,
  launchCutoffMs: 50 * 60 * 1000,
  transportTimeoutMs: 15000,
});
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const identifier = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const terminal = new Set(['success', 'error', 'canceled', 'crashed']);
const fail = (code) => {
  throw Error('FOUNDATION_' + code);
};
const payload = (r) => (object(r?.structuredContent) ? r.structuredContent : null);

/** The installed connector schemas, with no inputs, includeData or error text. */
export function createFoundationMcpPort({ getWorkflowDetails, executeWorkflow, getExecution }) {
  return Object.freeze({
    details: async ({ workflowId }) => payload(await getWorkflowDetails({ workflowId }))?.workflow ?? null,
    start: async ({ workflowId }) => {
      const r = payload(await executeWorkflow({ workflowId, executionMode: 'manual' }));
      return r ? { status: r.status, executionId: r.executionId } : null;
    },
    metadata: async ({ workflowId, executionId }) =>
      payload(await getExecution({ workflowId, executionId, includeData: false }))?.execution ?? null,
    cancellationSupported: false,
  });
}

function preflight(workflow, spec, versionId) {
  if (
    !object(workflow) ||
    workflow.id !== spec.id ||
    workflow.versionId !== versionId ||
    workflow.canExecute !== true ||
    !Array.isArray(workflow.scopes) ||
    !workflow.scopes.includes('workflow:execute') ||
    !Array.isArray(workflow.nodes)
  )
    fail('CONTROL_PREFLIGHT');
  const s = workflow.settings;
  if (
    !object(s) ||
    s.availableInMCP !== true ||
    s.saveDataSuccessExecution !== 'none' ||
    s.saveDataErrorExecution !== 'none' ||
    s.saveManualExecutions !== false ||
    s.saveExecutionProgress !== false
  )
    fail('CONTROL_PREFLIGHT');
  const eligible = workflow.nodes.filter(
    (n) =>
      n.disabled !== true &&
      [
        'n8n-nodes-base.manualTrigger',
        'n8n-nodes-base.scheduleTrigger',
        'n8n-nodes-base.webhook',
        'n8n-nodes-base.formTrigger',
        '@n8n/n8n-nodes-langchain.chatTrigger',
      ].includes(n.type),
  );
  if (eligible.length !== 1 || eligible[0].type !== 'n8n-nodes-base.manualTrigger') fail('CONTROL_PREFLIGHT');
}
function metadataProjection(row, workflowId, executionId, intentAt, observedAt, versionId) {
  if (
    !object(row) ||
    row.id !== executionId ||
    row.workflowId !== workflowId ||
    row.workflowVersionId !== versionId ||
    row.mode !== 'manual' ||
    typeof row.status !== 'string' ||
    ![...terminal, 'new', 'running', 'waiting', 'unknown'].includes(row.status)
  )
    return null;
  const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  if (
    terminal.has(row.status) &&
    (!date(row.startedAt) || !date(row.stoppedAt) || Date.parse(row.stoppedAt) < Date.parse(row.startedAt))
  )
    return null;
  if (
    date(row.startedAt) &&
    (Date.parse(row.startedAt) < intentAt - 30000 || Date.parse(row.startedAt) > observedAt + 30000)
  )
    return null;
  if (date(row.stoppedAt) && Date.parse(row.stoppedAt) > observedAt + 30000) return null;
  return {
    executionId,
    workflowId,
    mode: row.mode,
    status: row.status,
    startedAt: date(row.startedAt) ? row.startedAt : null,
    stoppedAt: date(row.stoppedAt) ? row.stoppedAt : null,
  };
}

/**
 * The append port MUST resolve only after the bounded non-secret journal is
 * durably flushed. Prior unresolved intents fence the whole controller. A
 * fresh object must not be used to replay an uncertain case or replenish caps.
 * Terminal metadata is mandatory; row absence and business receipts cannot
 * masquerade as native completion. Current retention-none graphs therefore
 * still need the observable-terminal capability described in the packet.
 */
export function createFoundationExecutionController({
  activeWindowId,
  bindings,
  port,
  journal,
  previousEvents = [],
  now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  callTimeoutMs = foundationControlLimits.transportTimeoutMs,
  caseReceiptValidator = assertFoundationRuntimeCaseReceipt,
  nativeReader,
  bindingFor,
  settlementReader,
  nativeTransport,
  controlBudget,
  baselineIdsByKey,
  runtimeBindingValidator,
  callbackCases,
}) {
  if (nativeReader !== undefined)
    return createFoundationNativeController({
      ...(activeWindowId === undefined ? {} : { activeWindowId }),
      bindings,
      port,
      journal,
      nativeReader,
      bindingFor,
      settlementReader,
      nativeTransport,
      controlBudget,
      baselineIdsByKey,
      now,
      pause,
      callTimeoutMs,
      caseReceiptValidator,
      callbackCases,
      ...(runtimeBindingValidator === undefined ? {} : { runtimeBindingValidator }),
    });
  bindings = parseN8nBindings(bindings);
  if (typeof journal?.append !== 'function' || !Array.isArray(previousEvents)) fail('CONTROL_JOURNAL');
  if (
    !Number.isInteger(callTimeoutMs) ||
    callTimeoutMs < 1 ||
    callTimeoutMs > foundationControlLimits.transportTimeoutMs
  )
    fail('CONTROL_TIMEOUT');
  const specs = new Map(foundationAcceptancePlan().cases.map((s) => [s.id, s]));
  const attempted = new Set(previousEvents.filter((e) => e.event === 'start_intent').map((e) => e.caseId));
  const linked = new Map();
  let stopped = previousEvents.some((e) => e.event === 'start_intent'),
    native = 0,
    requests = 0,
    busy = false,
    pendingCalls = 0;
  const began = now();
  const append = async (event) => {
    await journal.append(Object.freeze(event));
  };
  async function call(kind, args) {
    if (
      requests >= foundationControlLimits.mcpRequests ||
      now() - began >= foundationControlLimits.deadlineMs
    )
      fail('CONTROL_BUDGET');
    requests++;
    await append({ event: 'mcp_request_intent', ordinal: requests, kind, ...args });
    // Durable storage can itself take time; do not start after a deadline that
    // elapsed while the intent was being flushed.
    if (
      now() - began >= foundationControlLimits.deadlineMs ||
      (kind === 'start' && now() - began >= foundationControlLimits.launchCutoffMs)
    )
      fail('CONTROL_BUDGET');
    let timer;
    pendingCalls++;
    const response = Promise.resolve()
      .then(() => port[kind](args))
      .catch(() => null)
      .finally(() => {
        pendingCalls--;
      });
    try {
      return await Promise.race([
        response,
        new Promise((resolve) => {
          timer = setTimeout(
            () => resolve(null),
            Math.min(callTimeoutMs, Math.max(1, foundationControlLimits.deadlineMs - (now() - began))),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function observe(workflowId, executionId, intentAt, versionId) {
    for (let i = 0; i < foundationControlLimits.pollsPerExecution; i++) {
      if (i) await pause(foundationControlLimits.pollIntervalMs);
      const r = metadataProjection(
        await call('metadata', { workflowId, executionId }),
        workflowId,
        executionId,
        intentAt,
        now(),
        versionId,
      );
      if (!r) return { state: 'completion_unobservable', executionId, cancellationSupported: false };
      await append({ event: 'native_metadata', ...r });
      if (terminal.has(r.status)) return { state: 'terminal', ...r, cancellationSupported: false };
    }
    return { state: 'terminal_unconfirmed', executionId, cancellationSupported: false };
  }
  return Object.freeze({
    async runCase({ caseId, workflowKey, versionId, caseReceipt }) {
      if (busy) fail('CONTROLLER_BUSY');
      if (stopped) fail('CONTROLLER_STOPPED');
      if (attempted.has(caseId)) fail('CASE_ALREADY_ATTEMPTED');
      const c = specs.get(caseId),
        ref = bindings.workflowRefs[workflowKey];
      if (!c || c.workflowKey !== workflowKey || !ref || !identifier(versionId)) fail('CONTROL_CASE');
      const saved = caseReceiptValidator(caseReceipt);
      if (
        !object(saved) ||
        saved.status !== 'case_draft_verified' ||
        saved.caseId !== caseId ||
        saved.workflowId !== ref.id ||
        saved.versionId !== versionId
      )
        fail('CONTROL_CASE_RECEIPT');
      if (
        native + c.upperBounds.nativeExecutions > foundationControlLimits.nativeExecutions ||
        now() - began >= foundationControlLimits.launchCutoffMs
      )
        fail('CONTROL_BUDGET');
      // Acquire before the first await, including two concurrent same-case
      // invocations. Full nested/callback upper bound is reserved before start.
      busy = true;
      try {
        preflight(await call('details', { workflowId: ref.id }), ref, versionId);
        attempted.add(caseId);
        native += c.upperBounds.nativeExecutions;
        // Fencing state is written before even attempting a start.
        stopped = true;
        const intentAt = now();
        await append({
          event: 'start_intent',
          caseId,
          workflowKey,
          workflowId: ref.id,
          versionId,
          intentAt: new Date(intentAt).toISOString(),
        });
        const ack = await call('start', { workflowId: ref.id, executionMode: 'manual' });
        if (
          !object(ack) ||
          ack.status !== 'started' ||
          !identifier(ack.executionId) ||
          linked.has(ack.executionId)
        ) {
          stopped = true;
          const result = {
            state: 'start_unknown',
            caseId,
            workflowKey,
            executionId: null,
            cancellationSupported: false,
          };
          await append({ event: 'case_stop', ...result });
          return result;
        }
        linked.set(ack.executionId, { caseId, workflowKey });
        await append({ event: 'start_ack', caseId, workflowKey, executionId: ack.executionId });
        let observed;
        try {
          observed = await observe(ref.id, ack.executionId, intentAt, versionId);
        } catch {
          observed = {
            state: 'terminal_unconfirmed',
            executionId: ack.executionId,
            cancellationSupported: false,
          };
        }
        const result = { ...observed, caseId, workflowKey, nestedCoverage: 'not_established' };
        await append({ event: 'case_result', ...result });
        // A terminal parent cannot re-arm admission while canonical detached
        // children still lack an authoritative linkage/terminal receipt.
        if (
          result.state === 'terminal' &&
          result.status === 'success' &&
          c.upperBounds.nativeExecutions === 1
        )
          stopped = false;
        return result;
      } finally {
        busy = false;
      }
    },
    async observeNested({ parentExecutionId, workflowKey, executionId }) {
      const parent = linked.get(parentExecutionId),
        ref = bindings.workflowRefs[workflowKey];
      if (!parent || !ref || !identifier(executionId)) fail('NESTED_LINK');
      // The installed metadata-only tool has no authenticated parent/child
      // linkage projection. Caller-supplied IDs or source labels are not proof.
      // No guessed child is observed or accepted until that capability exists.
      fail('NESTED_CAPABILITY_UNAVAILABLE');
    },
    snapshot: () => ({
      stopped,
      nativeExecutions: native,
      observedExecutionIds: linked.size,
      pendingTransportCalls: pendingCalls,
      mcpRequests: requests,
      cancellationSupported: false,
    }),
  });
}
