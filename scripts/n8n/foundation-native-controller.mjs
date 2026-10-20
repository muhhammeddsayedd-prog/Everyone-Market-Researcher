import { randomBytes } from 'node:crypto';
import { foundationAcceptancePlan } from '../../n8n/foundation/materialize-acceptance-case.mjs';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import {
  assertFoundationRuntimeBinding,
  assertFoundationRuntimeCaseReceipt,
} from './foundation-runtime-control.mjs';
import {
  assertFoundationNativeReader,
  assertFoundationNativeReceipt,
  assertFoundationNativeMetadataReceipt,
} from './foundation-native-reader.mjs';
import {
  assertFoundationControlJournal,
  assertFoundationControlBudget,
} from './foundation-control-state.mjs';
import {
  assertFoundationSettlementReader,
  assertFoundationSettlementReceipt,
  assertFoundationProviderOrigins,
} from './foundation-native-settlement.mjs';
import { assertFoundationNativeCleanupReceipt } from './foundation-native-cleanup.mjs';
import { assertFoundationCallbackCases, assertFoundationCallbackCase } from './foundation-callback-cases.mjs';

// The existing execution-controller entry selects this private native branch.
// No default transport, credential loader, live admission or approval exists.
const closures = new WeakMap(),
  active = new WeakSet();
const positive = (v) => typeof v === 'string' && /^[1-9]\d{0,31}$/.test(v);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const goodTerminal = new Set(['success', 'error']);
const manualRetention = new Set(['WF-00', 'WF-91', 'WF-99', 'SUB-INGEST', 'SUB-COST']);
const omittedIntegrated = new Set(['WF-00', 'WF-99', 'SUB-INGEST', 'SUB-COST']);
const fail = () => {
  throw Error('FOUNDATION_NATIVE_CONTROL_BLOCKED');
};
const sync = (value) => {
  if (value && typeof value.then === 'function') {
    Promise.resolve(value).catch(() => {});
    fail();
  }
  return value;
};
const syncVoid = (value) => {
  if (sync(value) !== undefined) fail();
};
const frozenArray = (values) => Object.freeze([...values]);
export const foundationNativeAdmissionReserve = Object.freeze({
  shutdown: 460,
  perNative: 10,
  discovery: 64,
  preflight: 3,
  boundedRead: 4,
});

export function assertFoundationNativeClosure(closure, { receipt } = {}) {
  const owned = closures.get(closure);
  if (!owned || !Object.isFrozen(closure) || !owned.has(receipt) || closure.settled !== true) fail();
  return closure;
}

function policy(binding, key, manual) {
  const settings = binding.body?.settings;
  if (
    !object(settings) ||
    settings.saveExecutionProgress !== false ||
    settings.saveManualExecutions !== manualRetention.has(key) ||
    settings.saveDataSuccessExecution !== (omittedIntegrated.has(key) ? 'none' : 'all') ||
    settings.saveDataErrorExecution !== (omittedIntegrated.has(key) ? 'none' : 'all')
  )
    fail();
  if (manual) {
    const triggers = binding.body.nodes.filter(
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
    if (
      settings.availableInMCP !== true ||
      triggers.length !== 1 ||
      triggers[0].type !== 'n8n-nodes-base.manualTrigger'
    )
      fail();
  }
}

export function createFoundationNativeController({
  bindings,
  port,
  journal,
  nativeReader,
  bindingFor,
  settlementReader,
  nativeTransport,
  controlBudget,
  baselineIdsByKey,
  now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  callTimeoutMs = 15000,
  caseReceiptValidator = assertFoundationRuntimeCaseReceipt,
  runtimeBindingValidator = assertFoundationRuntimeBinding,
  callbackCases,
}) {
  try {
    bindings = parseN8nBindings(bindings);
    assertFoundationNativeReader(nativeReader);
    assertFoundationControlJournal(journal);
    assertFoundationSettlementReader(settlementReader);
    if (callbackCases !== undefined) assertFoundationCallbackCases(callbackCases);
    if (
      typeof bindingFor !== 'function' ||
      typeof port?.details !== 'function' ||
      typeof port?.start !== 'function' ||
      typeof now !== 'function' ||
      typeof pause !== 'function' ||
      typeof caseReceiptValidator !== 'function' ||
      typeof runtimeBindingValidator !== 'function' ||
      !Number.isInteger(callTimeoutMs) ||
      callTimeoutMs < 1 ||
      callTimeoutMs > 15000 ||
      !object(baselineIdsByKey)
    )
      fail();
  } catch {
    fail();
  }
  assertFoundationControlBudget(controlBudget, { journal });
  const deadlineAt = controlBudget.snapshot().deadlineAt,
    cutoffAt = deadlineAt - 600000;
  if (!Number.isFinite(now()) || deadlineAt <= now() || deadlineAt > now() + 3600000) fail();
  assertFoundationControlBudget(controlBudget, { journal, deadlineAt });
  const plan = foundationAcceptancePlan(),
    selected = new Map(plan.cases.filter((x) => x.recommendedLive).map((x) => [x.id, x]));
  const keys = Object.keys(foundationRuntimeCheckpoint.workflows),
    baselines = new Map(),
    baselineAll = new Set();
  if (Object.keys(baselineIdsByKey).length !== 25) fail();
  for (const key of keys) {
    const ids = baselineIdsByKey[key];
    if (
      !Array.isArray(ids) ||
      ids.length > 240 ||
      ids.some((id) => !positive(id)) ||
      new Set(ids).size !== ids.length
    )
      fail();
    for (const id of ids) {
      if (baselineAll.has(id)) fail();
      baselineAll.add(id);
    }
    baselines.set(key, [...ids]);
  }
  const attempted = new Set(),
    registry = new Map(),
    cases = new Map(),
    stoppedIds = new Set(),
    cleanedIds = new Set(),
    unknownCandidates = new Map();
  let unknownInventoryComplete = true;
  let reserved = 0,
    pendingCalls = 0,
    stopped = false,
    admissionClosed = false,
    errorGroup = false,
    errorOrdinal = 0;
  for (const row of journal.rows) {
    if (row.event === 'native_case_intent' || row.event === 'native_error_group_intent') {
      if (!Number.isSafeInteger(row.nativeExecutions) || row.nativeExecutions < 1) fail();
      reserved += row.nativeExecutions;
      if (row.caseId) attempted.add(row.caseId);
      stopped = true;
    }
    if (row.event === 'native_start_ack') {
      if (!positive(row.executionId) || registry.has(row.executionId)) fail();
      registry.set(row.executionId, { caseId: row.caseId, key: row.workflowKey, receipt: null });
    }
  }
  if (reserved > 120) fail();
  const append = (row) => syncVoid(journal.append(Object.freeze(row)));
  const remaining = (start = false) => {
    if (!Number.isFinite(now()) || now() >= deadlineAt || (start && (admissionClosed || now() >= cutoffAt)))
      fail();
    return deadlineAt - now();
  };
  const at = () => new Date(now()).toISOString();
  const preserveShutdown = (needed) => {
    if (2048 - controlBudget.snapshot().attempts < foundationNativeAdmissionReserve.shutdown + needed) fail();
  };
  const admitCaseCapacity = (upper) =>
    preserveShutdown(
      upper * foundationNativeAdmissionReserve.perNative +
        foundationNativeAdmissionReserve.discovery +
        foundationNativeAdmissionReserve.preflight,
    );
  const readerIdle = () => {
    const state = nativeReader.state();
    return state.pendingRequests === 0 && state.unclosedResponses === 0 && state.busy === false;
  };
  const getBinding = (key, caseReceipt) => {
    const binding = sync(bindingFor(key, caseReceipt === undefined ? {} : { caseReceipt }));
    const checked = sync(runtimeBindingValidator(binding));
    if (!object(checked) || checked.workflowId !== bindings.workflowRefs[key]?.id) fail();
    policy(checked, key, caseReceipt !== undefined);
    return checked;
  };
  async function bounded(fn, admission, start = false, composite = false, shutdown = false) {
    remaining(start);
    if (!shutdown) preserveShutdown(foundationNativeAdmissionReserve.boundedRead);
    if (admission) syncVoid(controlBudget.admit(admission));
    remaining(start);
    if (!shutdown) preserveShutdown(foundationNativeAdmissionReserve.boundedRead);
    const controller = new AbortController();
    // Reader/settlement composites own their individual 15-second calls and
    // finite loops. A second 15-second envelope would cancel a valid 10-second
    // provider stability gap plus its two metadata requests. The batch deadline
    // still bounds their aggregate. The fixed poll wait gets scheduling grace;
    // this does not extend any HTTP timeout.
    const duration = Math.min(
      composite === 'pause' ? 16000 : composite ? remaining(start) : callTimeoutMs,
      remaining(start),
    );
    let timer;
    pendingCalls++;
    const work = Promise.resolve()
      .then(() => {
        remaining(start);
        if (!shutdown) preserveShutdown(foundationNativeAdmissionReserve.boundedRead);
        return fn(controller.signal);
      })
      .finally(() => {
        pendingCalls--;
      });
    try {
      return await Promise.race([
        work,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Error('FOUNDATION_NATIVE_CONTROL_BLOCKED'));
          }, duration);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  function claim(id, key, state) {
    if (
      !positive(id) ||
      baselineAll.has(id) ||
      (registry.has(id) && registry.get(id).caseId !== state.caseId)
    )
      fail();
    if (!registry.has(id)) {
      if (state.receipts.size + state.pendingIds.size >= state.upper || registry.size >= 120) fail();
      registry.set(id, { caseId: state.caseId, key, receipt: null, causal: false });
      state.pendingIds.add(id);
    } else if (registry.get(id).key !== key) fail();
  }
  async function observe(
    key,
    id,
    binding,
    state,
    expectedMode,
    expectedTraceparent,
    expectedProviderCallbackId,
  ) {
    claim(id, key, state);
    registry.get(id).binding = binding;
    if (state.receipts.has(id)) return state.receipts.get(id);
    let metadata;
    for (let round = 0; round < 8; round++) {
      if (round) {
        remaining();
        await bounded(() => pause(15000), undefined, false, 'pause');
      }
      metadata = await bounded(() =>
        nativeReader.metadata({
          workflowKey: key,
          executionId: id,
          binding,
          ...(expectedMode ? { expectedMode } : {}),
          intentAt: state.intentAt,
        }),
      );
      assertFoundationNativeMetadataReceipt(metadata);
      registry.get(id).metadataReceipt = metadata;
      if (goodTerminal.has(metadata.status)) break;
      if (['canceled', 'crashed', 'unknown'].includes(metadata.status)) fail();
    }
    if (!goodTerminal.has(metadata?.status)) fail();
    const receipt = await bounded(
      () =>
        nativeReader.read({
          workflowKey: key,
          executionId: id,
          binding,
          metadataReceipt: metadata,
          ...(expectedMode ? { expectedMode } : {}),
          intentAt: state.intentAt,
          ...(Array.isArray(expectedTraceparent)
            ? { expectedTraceparents: expectedTraceparent }
            : expectedTraceparent
              ? { expectedTraceparent }
              : {}),
        }),
      undefined,
      false,
      true,
    );
    assertFoundationNativeReceipt(receipt);
    if (
      !goodTerminal.has(receipt.status) ||
      receipt.waitTill !== null ||
      receipt.privacyChecked !== true ||
      receipt.transportClosed !== true
    )
      fail();
    // Webhook input remains private until its provider identity agrees with a
    // genuine SQL original or the fixed, branded callback case. Identifier
    // syntax and a known-secret scan cannot make an unknown input publishable.
    if (key === 'WF-19' && receipt.mode === 'webhook') {
      if (receipt.nativeProviderCallback !== null && receipt.nativeProviderCallback !== undefined) {
        if (
          expectedProviderCallbackId === undefined ||
          receipt.nativeProviderCallback.apifyRunId !== expectedProviderCallbackId
        )
          fail();
      } else if (expectedProviderCallbackId !== undefined) fail();
    }
    append({
      event: 'native_full_receipt',
      caseId: state.caseId,
      ...Object.fromEntries(
        [
          'executionId',
          'workflowId',
          'key',
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
          'nativeGatewayRequests',
          'nativeProviderCallback',
          'errorDispatchExpected',
          'missingNativeChildCalls',
          ...(receipt.traceparent === undefined ? [] : ['traceparent']),
        ].map((k) => [k, receipt[k]]),
      ),
    });
    state.receipts.set(id, receipt);
    state.pendingIds.delete(id);
    registry.get(id).receipt = receipt;
    return receipt;
  }
  async function discoverMany(key, state, amount) {
    const baseline = new Set([...baselines.get(key), ...registry.keys()]);
    if (baseline.size > 240) fail();
    for (let round = 0; round < 8; round++) {
      if (round) await bounded(() => pause(15000), undefined, false, 'pause');
      const result = await bounded(
        () => nativeReader.discover({ workflowKey: key, baselineIds: [...baseline] }),
        undefined,
        false,
        true,
      );
      if (
        result.paginationComplete !== true ||
        result.privacyChecked !== true ||
        result.transportClosed !== true
      )
        fail();
      for (const candidate of result.candidates) {
        if (unknownCandidates.size < 120) unknownCandidates.set(candidate.executionId, key);
        else if (!unknownCandidates.has(candidate.executionId)) unknownInventoryComplete = false;
      }
      if (result.candidates.length > amount) {
        append({
          event: 'native_discovery_candidates',
          caseId: state.caseId,
          workflowId: bindings.workflowRefs[key].id,
          executionIds: result.candidates.slice(0, 120).map((x) => x.executionId),
          state: 'ambiguous',
        });
        fail();
      }
      if (result.candidates.length === amount) {
        for (const candidate of result.candidates) {
          if (
            !positive(candidate.executionId) ||
            baselineAll.has(candidate.executionId) ||
            registry.has(candidate.executionId) ||
            candidate.workflowId !== bindings.workflowRefs[key].id
          )
            fail();
          claim(candidate.executionId, key, state);
        }
        return result.candidates.map((x) => x.executionId);
      }
    }
    fail();
  }
  async function discoverUnique(key, state) {
    return (await discoverMany(key, state, 1))[0];
  }
  async function tree(receipt, state, ancestors = new Set()) {
    if (ancestors.has(receipt.executionId)) fail();
    const path = new Set([...ancestors, receipt.executionId]),
      links = new Map();
    for (const link of receipt.nativeChildren) {
      const old = links.get(link.executionId);
      if (old && old.key !== link.key) fail();
      links.set(link.executionId, link);
    }
    const accept = async (id, key, kind) => {
      if (path.has(id)) fail();
      claim(id, key, state);
      if (kind === 'reciprocal') registry.get(id).causal = true;
      const child = await observe(
        key,
        id,
        getBinding(key),
        state,
        kind === 'native_error_backlink' ? 'error' : 'integrated',
      );
      if (
        child.nativeParent?.executionId !== receipt.executionId ||
        child.nativeParent?.workflowId !== receipt.workflowId
      ) {
        registry.get(id).causal = false;
        fail();
      }
      registry.get(id).causal = true;
      unknownCandidates.delete(id);
      if (!state.edges.has(receipt.executionId)) state.edges.set(receipt.executionId, new Set());
      state.edges.get(receipt.executionId).add(id);
      append({
        event: 'native_tree_link',
        caseId: state.caseId,
        executionId: id,
        parentExecutionId: receipt.executionId,
        parentWorkflowId: receipt.workflowId,
        kind,
      });
      await tree(child, state, path);
      return child;
    };
    for (const link of links.values()) await accept(link.executionId, link.key, 'reciprocal');
    for (const missing of receipt.missingNativeChildCalls) {
      const id = await discoverUnique(missing.key, state);
      await accept(id, missing.key, 'native_backlink');
    }
    if (receipt.errorDispatchExpected) {
      const id = await discoverUnique('WF-90', state);
      const child = await accept(id, 'WF-90', 'native_error_backlink');
      if (child.mode !== 'error') fail();
    }
  }
  async function finish(state, root, walk = true) {
    if (walk) await tree(root, state);
    if (state.caseId.startsWith('smoke.')) {
      // A provider callback is a separate webhook root. Its native input is
      // correlated to the authenticated original SQL admission; no n8n parent
      // edge or sender-authentication claim is fabricated for that root.
      const originals = assertFoundationProviderOrigins(
        await bounded(() =>
          settlementReader.originals({
            caseId: state.caseId,
            receipts: frozenArray(state.receipts.values()),
          }),
        ),
      );
      if (
        originals.caseId !== state.caseId ||
        originals.windowId !== foundationRuntimeCheckpoint.windowId ||
        originals.settlementProven !== false ||
        originals.providerOrigins.length !== 1 ||
        originals.providerOrigins[0].nativeExecutionId !== root.executionId ||
        JSON.stringify([...originals.executionIds].sort()) !==
          JSON.stringify([...state.receipts.keys()].sort())
      )
        fail();
      const origin = originals.providerOrigins[0];
      if (
        state.providerRuns.length &&
        (state.providerRuns.length !== 1 || state.providerRuns[0] !== origin.apifyRunId)
      )
        fail();
      state.providerRuns = [origin.apifyRunId];
      const callbackId = await discoverUnique('WF-19', state);
      const callback = await observe(
        'WF-19',
        callbackId,
        getBinding('WF-19'),
        state,
        'webhook',
        undefined,
        origin.apifyRunId,
      );
      if (callback.nativeParent !== null || callback.nativeProviderCallback?.apifyRunId !== origin.apifyRunId)
        fail();
      registry.get(callbackId).causal = true;
      unknownCandidates.delete(callbackId);
      append({
        event: 'native_callback_origin',
        caseId: state.caseId,
        executionId: callbackId,
        workflowId: callback.workflowId,
        nativeExecutionId: root.executionId,
        apifyRunId: origin.apifyRunId,
        runId: origin.runId,
        accountId: origin.accountId,
        kind: 'authenticated_original_input',
      });
      await tree(callback, state);
    }
    if (
      state.callbackCase &&
      (root.traceparent !== state.callbackCase.traceparent ||
        root.nativeProviderCallback?.apifyRunId !== state.callbackCase.expectedApifyRunId ||
        root.nativeProviderCallback?.eventType !== state.callbackCase.expectedEventType)
    )
      fail();
    if (state.pendingIds.size || pendingCalls || !readerIdle()) fail();
    if (state.spec?.workflowKey === 'WF-00') {
      const expected = state.spec.expectedTargets.filter((key) => key !== 'audit');
      const actual = [
        ...new Set([...(state.edges.get(root.executionId) ?? [])].map((id) => state.receipts.get(id).key)),
      ].sort();
      if (expected.length && JSON.stringify([...new Set(expected)].sort()) !== JSON.stringify(actual)) fail();
    }
    if (state.ordinal !== undefined) {
      if (root.status !== 'error' || root.errorDispatchExpected !== true) fail();
      const notify = [...state.receipts.values()].filter((r) => r.key === 'SUB-NOTIFY');
      if (notify.length !== (state.ordinal === 3 ? 1 : 0)) fail();
    } else if (state.caseId === 'control.machine_domain') {
      const d = root.nativeDomainDenial;
      if (
        root.status !== 'error' ||
        root.errorDispatchExpected ||
        state.receipts.size !== 1 ||
        state.providerRuns.length ||
        root.nativeGatewayRequests.length ||
        d?.kind !== 'foundation_native_domain_denial_projection' ||
        d.restrictionCode !== 'native_credential_domain_blocked' ||
        d.credentialId !== 'EmrM03Machine19' ||
        d.httpRequestIssued !== false ||
        d.actorStarts !== 0
      )
        fail();
      append({
        event: 'native_domain_denial',
        caseId: state.caseId,
        executionId: root.executionId,
        workflowId: root.workflowId,
        kind: 'native_credential_domain_blocked',
        state: 'pre_http_denial_verified',
        sourceLocation: d.targetAudience,
        at: at(),
      });
    } else if (root.status !== 'success') fail();
    const receiptList = frozenArray(state.receipts.values());
    const settled = await bounded(
      () =>
        settlementReader.settle({
          caseId: state.caseId,
          receipts: receiptList,
          providerRuns: state.providerRuns,
        }),
      undefined,
      false,
      true,
      true,
    );
    const verified = assertFoundationSettlementReceipt(settled);
    if (
      verified.caseId !== state.caseId ||
      verified.windowId !== foundationRuntimeCheckpoint.windowId ||
      verified.transportSettled !== true ||
      JSON.stringify([...verified.executionIds].sort()) !==
        JSON.stringify(receiptList.map((x) => x.executionId).sort()) ||
      pendingCalls ||
      !readerIdle()
    )
      fail();
    append({
      event: 'native_external_settlement',
      ...Object.fromEntries(
        [
          'caseId',
          'windowId',
          'executionIds',
          'gatewayRequestIds',
          'providerRunIds',
          'startedAt',
          'observedAt',
          'transportSettled',
          ...(verified.providerTerminals === undefined ? [] : ['providerTerminals']),
          ...(verified.costParityVerified === undefined ? [] : ['costParityVerified']),
        ].map((key) => [key, verified[key]]),
      ),
    });
    if (
      state.caseId.startsWith('smoke.') &&
      (verified.costParityVerified !== true ||
        verified.providerTerminals?.length !== 1 ||
        verified.providerTerminals[0].apifyRunId !== state.providerRuns[0] ||
        verified.providerTerminals[0].status !== 'SUCCEEDED' ||
        !Number.isFinite(Number(verified.providerTerminals[0].costUsd)) ||
        Number(verified.providerTerminals[0].costUsd) < 0 ||
        Number(verified.providerTerminals[0].costUsd) > 1)
    )
      fail();
    const closure = Object.freeze({
      kind: 'foundation_native_closure',
      batchId: foundationRuntimeCheckpoint.windowId,
      caseId: state.caseId,
      executionIds: frozenArray(state.receipts.keys()),
      settled: true,
      closedAt: at(),
      owner: 'Mohamed Abdelrahman',
    });
    append({
      event: 'native_case_result',
      caseId: state.caseId,
      state: 'native_settled',
      executionIds: closure.executionIds,
      settled: true,
      at: at(),
    });
    closures.set(closure, new Set(receiptList));
    state.closure = closure;
    state.settlement = verified;
    stopped = admissionClosed;
    return Object.freeze({
      state: 'native_settled',
      caseId: state.caseId,
      executionId: root.executionId,
      executionIds: closure.executionIds,
      closure,
      businessAcceptanceProven: false,
    });
  }
  const startState = (caseId, key, upper, spec) => {
    if (
      admissionClosed ||
      stopped ||
      pendingCalls ||
      !readerIdle() ||
      attempted.has(caseId) ||
      reserved + upper > 120 ||
      active.has(journal)
    )
      fail();
    remaining(true);
    admitCaseCapacity(upper);
    active.add(journal);
    stopped = true;
    attempted.add(caseId);
    reserved += upper;
    const state = {
      caseId,
      key,
      upper,
      spec,
      receipts: new Map(),
      edges: new Map(),
      pendingIds: new Set(),
      intentAt: now(),
      providerRuns: [],
    };
    cases.set(caseId, state);
    try {
      append({
        event: 'native_case_intent',
        caseId,
        workflowKey: key,
        nativeExecutions: upper,
        intentAt: at(),
      });
    } catch {
      active.delete(journal);
      fail();
    }
    return state;
  };
  const unresolved = (state) => {
    stopped = true;
    const result = Object.freeze({
      state: 'native_unresolved',
      caseId: state.caseId,
      executionIds: frozenArray(state.receipts.keys()),
      closure: null,
      businessAcceptanceProven: false,
    });
    try {
      append({
        event: 'native_case_result',
        caseId: state.caseId,
        state: result.state,
        executionIds: result.executionIds,
        settled: false,
        at: at(),
      });
    } catch {
      /* The earlier durable intent remains fenced. */
    }
    return result;
  };
  const phaseBReady = () =>
    [
      'dispatch.vimeo',
      'automatic.error.1',
      'automatic.error.2',
      'automatic.error.3',
      'automatic.error.4',
    ].every((id) => {
      const state = cases.get(id);
      return state?.closure && [...state.receipts.keys()].every((executionId) => cleanedIds.has(executionId));
    });
  return Object.freeze({
    async runCase({ caseId, workflowKey, versionId, caseReceipt, providerRuns = [] } = {}) {
      const spec =
        caseId === 'control.machine_domain'
          ? {
              id: 'control.machine_domain',
              workflowKey: 'WF-99',
              upperBounds: { nativeExecutions: 1 },
            }
          : selected.get(caseId);
      if (
        !spec ||
        spec.workflowKey !== workflowKey ||
        !Array.isArray(providerRuns) ||
        providerRuns.length > 2 ||
        providerRuns.some((x) => typeof x !== 'string' || !/^[A-Za-z0-9]{5,64}$/.test(x))
      )
        fail();
      if (caseId.startsWith('smoke.') && !phaseBReady()) fail();
      if (
        caseId === 'smoke.second' &&
        (!cases.get('smoke.first')?.closure ||
          cases.get('smoke.first').settlement?.costParityVerified !== true ||
          cases.get('smoke.first').settlement?.providerTerminals?.[0]?.status !== 'SUCCEEDED')
      )
        fail();
      const saved = sync(caseReceiptValidator(caseReceipt));
      if (
        saved?.status !== 'case_draft_verified' ||
        saved.caseId !== caseId ||
        saved.workflowId !== bindings.workflowRefs[workflowKey].id ||
        saved.versionId !== versionId
      )
        fail();
      const binding = getBinding(workflowKey, caseReceipt);
      if (binding.versionId !== versionId) fail();
      const state = startState(caseId, workflowKey, spec.upperBounds.nativeExecutions, spec);
      state.providerRuns = [...providerRuns];
      try {
        await bounded(() => nativeReader.verifyBinding({ workflowKey, binding }));
        const details = await bounded(() => port.details({ workflowId: binding.workflowId }), {
          kind: 'details',
          workflowId: binding.workflowId,
        });
        if (
          details?.id !== binding.workflowId ||
          details.versionId !== binding.versionId ||
          details.canExecute !== true ||
          !details.scopes?.includes('workflow:execute')
        )
          fail();
        append({
          event: 'native_start_intent',
          caseId,
          workflowKey,
          workflowId: binding.workflowId,
          versionId,
          intentAt: at(),
        });
        const ack = await bounded(
          () => port.start({ workflowId: binding.workflowId, executionMode: 'manual' }),
          { kind: 'start', workflowId: binding.workflowId },
          true,
        );
        if (
          ack?.status !== 'started' ||
          !positive(ack.executionId) ||
          registry.has(ack.executionId) ||
          baselineAll.has(ack.executionId)
        )
          fail();
        claim(ack.executionId, workflowKey, state);
        registry.get(ack.executionId).causal = true;
        registry.get(ack.executionId).binding = binding;
        append({
          event: 'native_start_ack',
          caseId,
          workflowKey,
          workflowId: binding.workflowId,
          versionId,
          executionId: ack.executionId,
          intentAt: at(),
        });
        const root = await observe(workflowKey, ack.executionId, binding, state, 'manual');
        if (root.nativeParent !== null) fail();
        return await finish(state, root);
      } catch {
        return unresolved(state);
      } finally {
        active.delete(journal);
      }
    },
    async runAutomaticErrorCase(ordinal) {
      if (
        !Number.isInteger(ordinal) ||
        ordinal !== errorOrdinal + 1 ||
        ordinal < 1 ||
        ordinal > 4 ||
        !nativeTransport ||
        typeof nativeTransport.webhookError !== 'function' ||
        stopped ||
        active.has(journal) ||
        pendingCalls ||
        !readerIdle()
      )
        fail();
      remaining(true);
      admitCaseCapacity(ordinal === 3 ? 3 : 2);
      if (!errorGroup) {
        if (reserved + 9 > 120) fail();
        append({ event: 'native_error_group_intent', nativeExecutions: 9, intentAt: at() });
        reserved += 9;
        errorGroup = true;
      }
      const caseId = 'automatic.error.' + ordinal;
      const state = {
        caseId,
        key: 'WF-19',
        upper: ordinal === 3 ? 3 : 2,
        receipts: new Map(),
        edges: new Map(),
        pendingIds: new Set(),
        intentAt: now(),
        providerRuns: [],
        ordinal,
      };
      attempted.add(caseId);
      cases.set(caseId, state);
      active.add(journal);
      stopped = true;
      const traceparent =
        '00-' + randomBytes(16).toString('hex') + '-' + randomBytes(8).toString('hex') + '-01';
      try {
        const binding = getBinding('WF-19');
        await bounded(() => nativeReader.verifyBinding({ workflowKey: 'WF-19', binding }));
        append({
          event: 'native_webhook_intent',
          caseId,
          workflowId: binding.workflowId,
          traceparent,
          intentAt: at(),
        });
        await bounded(
          async (signal) =>
            nativeReader.webhookResponse({
              response: await nativeTransport.webhookError({ traceparent, signal }),
              signal,
              expectedHttpStatus: 500,
            }),
          { kind: 'webhook_start', workflowId: binding.workflowId },
          true,
        );
        const id = await discoverUnique('WF-19', state);
        const root = await observe('WF-19', id, binding, state, 'webhook', traceparent);
        if (root.nativeParent !== null) fail();
        registry.get(id).causal = true;
        unknownCandidates.delete(id);
        const result = await finish(state, root);
        errorOrdinal = ordinal;
        return result;
      } catch {
        return unresolved(state);
      } finally {
        active.delete(journal);
      }
    },
    async runCallbackCase(caseId) {
      if (
        !['callback.unknown', 'callback.equal_replay', 'callback.recovery_drill'].includes(caseId) ||
        !phaseBReady() ||
        typeof nativeTransport?.callbackCase !== 'function'
      )
        fail();
      assertFoundationCallbackCases(callbackCases);
      const first = cases.get('smoke.first');
      if (caseId !== 'callback.unknown' && (!first?.closure || !first.settlement)) fail();
      const state = startState(caseId, 'WF-19', 3);
      try {
        const binding = getBinding('WF-19');
        await bounded(() => nativeReader.verifyBinding({ workflowKey: 'WF-19', binding }));
        const wireCase = assertFoundationCallbackCase(
          await bounded(() =>
            callbackCases.prepare({
              caseId,
              ...(caseId === 'callback.unknown' ? {} : { settlementReceipt: first.settlement }),
            }),
          ),
        );
        state.callbackCase = wireCase;
        append({
          event: 'native_callback_intent',
          caseId,
          workflowId: binding.workflowId,
          traceparent: wireCase.traceparent,
          kind: wireCase.acknowledgementMode,
          intentAt: at(),
        });
        await bounded(
          async (signal) => {
            const metadata = await nativeReader.webhookResponse({
              response: await nativeTransport.callbackCase({ wireCase, signal }),
              signal,
              expectedHttpStatus: caseId === 'callback.unknown' ? 403 : 200,
            });
            // This deterministic drill withholds an already privately checked
            // HTTP ACK. It is neither a real transport failure nor a first-
            // ingestion registration race; native reconciliation still follows.
            return wireCase.acknowledgementMode === 'withhold_after_private_check' ? null : metadata;
          },
          { kind: 'webhook_start', workflowId: binding.workflowId },
          true,
          true,
        );
        const id = await discoverUnique('WF-19', state);
        const root = await observe(
          'WF-19',
          id,
          binding,
          state,
          'webhook',
          wireCase.traceparent,
          wireCase.expectedApifyRunId,
        );
        if (root.nativeParent !== null) fail();
        registry.get(id).causal = true;
        unknownCandidates.delete(id);
        return await finish(state, root);
      } catch {
        return unresolved(state);
      } finally {
        active.delete(journal);
      }
    },
    async runConcurrentCallbackCases() {
      if (!phaseBReady() || typeof nativeTransport?.callbackCase !== 'function') fail();
      assertFoundationCallbackCases(callbackCases);
      const first = cases.get('smoke.first');
      if (!first?.closure || !first.settlement) fail();
      const state = startState('callback.concurrent_pair', 'WF-19', 6);
      try {
        const binding = getBinding('WF-19');
        await bounded(() => nativeReader.verifyBinding({ workflowKey: 'WF-19', binding }));
        const wires = [];
        for (const caseId of ['callback.concurrent_a', 'callback.concurrent_b']) {
          const wireCase = assertFoundationCallbackCase(
            await bounded(() => callbackCases.prepare({ caseId, settlementReceipt: first.settlement })),
          );
          wires.push(wireCase);
          append({
            event: 'native_callback_intent',
            caseId: state.caseId,
            workflowId: binding.workflowId,
            traceparent: wireCase.traceparent,
            kind: caseId,
            intentAt: at(),
          });
        }
        // Both attempts are durably admitted before either POST. Transport
        // calls overlap; native processing interleavings are still observed,
        // not inferred from simultaneous client dispatch.
        for (let index = 0; index < wires.length; index++) {
          remaining(true);
          syncVoid(controlBudget.admit({ kind: 'webhook_start', workflowId: binding.workflowId }));
        }
        await bounded(
          async (signal) => {
            const attempts = await Promise.allSettled(
              wires.map((wireCase) =>
                bounded(() => nativeTransport.callbackCase({ wireCase, signal }), undefined, true),
              ),
            );
            let fault = attempts.some((attempt) => attempt.status !== 'fulfilled');
            for (const attempt of attempts) {
              if (attempt.status !== 'fulfilled') continue;
              try {
                await nativeReader.webhookResponse({
                  response: attempt.value,
                  signal,
                  expectedHttpStatus: 200,
                });
              } catch {
                fault = true;
              }
            }
            if (fault) fail();
          },
          undefined,
          true,
          true,
        );
        const ids = await discoverMany('WF-19', state, 2),
          traces = wires.map((x) => x.traceparent),
          observedTraces = new Set(),
          roots = [];
        for (const id of ids) {
          const root = await observe(
            'WF-19',
            id,
            binding,
            state,
            'webhook',
            traces,
            wires[0].expectedApifyRunId,
          );
          const wireCase = wires.find((x) => x.traceparent === root.traceparent);
          if (
            !wireCase ||
            observedTraces.has(root.traceparent) ||
            root.nativeParent !== null ||
            root.nativeProviderCallback?.apifyRunId !== wireCase.expectedApifyRunId ||
            root.nativeProviderCallback?.eventType !== wireCase.expectedEventType
          )
            fail();
          observedTraces.add(root.traceparent);
          registry.get(id).causal = true;
          unknownCandidates.delete(id);
          roots.push(root);
          await tree(root, state);
        }
        if (observedTraces.size !== 2 || roots.some((r) => r.status !== 'success')) fail();
        return await finish(state, roots[0], false);
      } catch {
        return unresolved(state);
      } finally {
        active.delete(journal);
      }
    },
    async stop({ executionId } = {}) {
      const owned = registry.get(executionId);
      if (
        !owned ||
        owned.causal !== true ||
        stoppedIds.has(executionId) ||
        active.has(journal) ||
        typeof nativeTransport?.request !== 'function'
      )
        fail();
      remaining();
      active.add(journal);
      stoppedIds.add(executionId);
      stopped = true;
      try {
        let receipt = owned.receipt ?? owned.metadataReceipt;
        if (!receipt) {
          const binding = sync(runtimeBindingValidator(owned.binding));
          receipt = await bounded(
            () => nativeReader.metadata({ workflowKey: owned.key, executionId, binding }),
            undefined,
            false,
            false,
            true,
          );
        }
        append({ event: 'native_stop_intent', executionId, workflowId: receipt.workflowId, at: at() });
        const ack = await bounded(
          async (signal) =>
            nativeReader.stopResponse({
              response: await nativeTransport.request({
                method: 'POST',
                path: '/api/v1/executions/' + executionId + '/stop',
                signal,
              }),
              receipt,
              signal,
            }),
          { kind: 'stop', workflowId: receipt.workflowId, executionId },
          false,
          false,
          true,
        );
        const state = ack.cancellationAcknowledged === true ? 'stop_acknowledged' : 'stop_unconfirmed';
        append({ event: 'native_stop_result', executionId, workflowId: receipt.workflowId, state, at: at() });
        return Object.freeze({ state, executionId, completionProven: false });
      } catch {
        return Object.freeze({ state: 'stop_unconfirmed', executionId, completionProven: false });
      } finally {
        active.delete(journal);
      }
    },
    closeAdmission() {
      admissionClosed = true;
      stopped = true;
    },
    authorizeExecution({ method, executionId } = {}) {
      const entry = registry.get(executionId);
      if (!positive(executionId) || !entry) return false;
      if (method === 'GET') return true;
      if (method === 'POST') return entry.causal === true;
      if (method !== 'DELETE' || entry.causal !== true || !entry.receipt || cleanedIds.has(executionId))
        return false;
      const closure = cases.get(entry.caseId)?.closure;
      if (!closure) return false;
      try {
        assertFoundationNativeClosure(closure, { receipt: entry.receipt });
        return true;
      } catch {
        return false;
      }
    },
    recordCleanup(result) {
      const state = cases.get(registry.get(result?.executionId)?.caseId);
      const receipt = state?.receipts.get(result?.executionId);
      if (!receipt || !state.closure || cleanedIds.has(receipt.executionId)) fail();
      assertFoundationNativeClosure(state.closure, { receipt });
      assertFoundationNativeCleanupReceipt(result, { receipt, closure: state.closure });
      if (
        result.state !== 'native_record_deleted' ||
        result.deleteAcknowledged !== true ||
        result.absenceVerified !== true ||
        result.residual !== false
      )
        fail();
      cleanedIds.add(receipt.executionId);
      return Object.freeze({ executionId: receipt.executionId, caseId: state.caseId, cleanupVerified: true });
    },
    caseReceipts: (caseId) => frozenArray(cases.get(caseId)?.receipts.values() ?? []),
    caseClosure: (caseId) => cases.get(caseId)?.closure ?? null,
    caseSettlement: (caseId) => cases.get(caseId)?.settlement ?? null,
    snapshot: () =>
      Object.freeze({
        stopped,
        admissionClosed,
        nativeExecutions: reserved,
        observedExecutionIds: registry.size,
        pendingTransportCalls: pendingCalls,
        controlAttempts: controlBudget.snapshot().attempts,
        residualExecutionIds: frozenArray(
          [...registry.entries()].filter(([, x]) => !cases.get(x.caseId)?.closure).map(([id]) => id),
        ),
        unknownCandidateIds: frozenArray(unknownCandidates.keys()),
        unknownInventoryComplete,
        unresolvedCaseIds: frozenArray([...attempted].filter((caseId) => !cases.get(caseId)?.closure)),
        cleanedExecutionIds: frozenArray(cleanedIds),
        phaseBReady: Boolean(phaseBReady()),
        executionAcceptanceProven: false,
      }),
  });
}
