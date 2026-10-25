import { readFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import {
  createFoundationLiveRuntime,
  createFoundationLiveManagementBudget,
  foundationLiveAuxiliaryStorage,
} from './foundation-live-runtime.mjs';
import { createFoundationLiveMcpBridge } from './foundation-live-runtime-mcp.mjs';
import {
  createFoundationLiveProviderReader,
  createFoundationLiveGatewayProbe,
  createFoundationLiveWriterCloser,
  createFoundationLiveBaselinePreflight,
  assertFoundationLiveBaselineReceipt,
} from './foundation-live-runtime-transport.mjs';
import {
  assertFoundationRuntimeRestorationAudit,
  createFoundationRuntimeJournal,
  runFoundationRuntimeSetup,
  restoreFoundationRuntime,
  saveFoundationRuntimeCase,
} from './foundation-runtime-control.mjs';
import {
  createFoundationRuntimeBaseline,
  createFoundationRuntimePlan,
  materializeFoundationRuntimeCase,
} from './foundation-runtime-plan.mjs';
import { createFoundationLiveManagementTransport } from './foundation-live-runtime-transport.mjs';
import { prepareFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';
import {
  createFoundationLiveSetup,
  createFoundationLiveSetupJournal,
  assertFoundationLiveDeployment,
} from './foundation-live-setup.mjs';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import {
  startFoundationAdminClient,
  readFoundationAdminStartupFailure,
} from '../db/foundation-admin-client.mjs';
import { createFoundationNativeTransport } from './foundation-native-transport.mjs';
import {
  createFoundationNativeReader,
  assertFoundationNativeReceipt,
  foundationNativeFailureCodes,
} from './foundation-native-reader.mjs';
import {
  createFoundationSettlementReader,
  foundationSettlementQuery,
  assertFoundationSettlementReceipt,
} from './foundation-native-settlement.mjs';
import { createFoundationCallbackCases } from './foundation-callback-cases.mjs';
import { createFoundationExecutionController } from './foundation-execution-control.mjs';
import {
  createFoundationControlJournal,
  createFoundationControlBudget,
} from './foundation-control-state.mjs';
import { createFoundationNativeCleanup } from './foundation-native-cleanup.mjs';
import { foundationAcceptancePlan } from '../../n8n/foundation/materialize-acceptance-case.mjs';
import {
  foundationRuntimeCheckpoint,
  foundationRuntimeBaselineFailureCodes,
} from './foundation-runtime-checkpoint.mjs';
import { createApifyRecoveryRuntime } from '../../packages/shared/src/n8n-apify-recovery.ts';
import {
  verifyFoundationLiveZeroSetup,
  assertFoundationLiveZeroSetupProof,
} from './foundation-live-zero-setup.mjs';
import {
  readFoundationClockAmendment,
  claimFoundationClockAmendment,
  assertFoundationLiveClockAmendmentProof,
} from './foundation-live-clock-amendment.mjs';
import {
  readFoundationPostcheckContinuation,
  claimFoundationPostcheckContinuation,
  assertFoundationLivePostcheckContinuationProof,
} from './foundation-live-postcheck-continuation.mjs';
import {
  readFoundationRemainingContinuation,
  claimFoundationRemainingContinuation,
  assertFoundationLiveRemainingContinuationProof,
} from './foundation-live-remaining-continuation.mjs';
import {
  readFoundationStartupReplacement,
  claimFoundationStartupReplacement,
  assertFoundationLiveStartupReplacementProof,
} from './foundation-live-startup-replacement.mjs';
import {
  readFoundationProjectVerifiedContinuation,
  claimFoundationProjectVerifiedContinuation,
  assertFoundationLiveProjectVerifiedContinuationProof,
  assertFoundationProjectVerifiedContinuationControlResume,
  foundationProjectVerifiedContinuationResumeCheckpoint,
  foundationProjectVerifiedContinuationUnadmittedUsage,
} from './foundation-live-project-verified-continuation.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const approvedHead = 'f42930f90c2de43c84f61ad6d966d0ee6074d70e';
const approvedPacketSha256 = '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712';
const windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
const fail = () => {
  throw Error('FOUNDATION_LIVE_CHILD_BLOCKED');
};
const exact = (v, keys) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
// Selected native-port access is checked before owned DB/Preview preparation.
// Browser observations prove the rendered control only; the subsequent REST
// guard remains responsible for saved metadata, version, graph and privacy.
export async function verifyFoundationLiveNativeMetadata({ port, workflow, admit, append, now }) {
  if (
    !port ||
    typeof port.discover !== 'function' ||
    workflow?.id !== foundationRuntimeCheckpoint.workflows['WF-00'].id ||
    typeof workflow.workflow?.name !== 'string' ||
    workflow.workflow.name.length < 1 ||
    workflow.workflow.name.length > 200 ||
    typeof admit !== 'function' ||
    typeof append !== 'function' ||
    typeof now !== 'function' ||
    (port.source !== undefined && !['mcp', 'browser_ui'].includes(port.source))
  )
    fail();
  const charged = admit({ kind: 'discovery', workflowId: workflow.id });
  if (charged !== undefined) {
    if (charged?.then) Promise.resolve(charged).catch(() => {});
    fail();
  }
  const value = await port.discover({ workflowId: workflow.id });
  const browserUi = port.source === 'browser_ui';
  if (
    browserUi
      ? !exact(value, ['source', 'id', 'renderedName', 'workflowUrl', 'executeControlEnabled']) ||
        value.source !== 'browser_ui' ||
        value.id !== workflow.id ||
        value.renderedName !== workflow.workflow.name ||
        value.executeControlEnabled !== true ||
        value.workflowUrl !== `https://muhhammedsayed.app.n8n.cloud/workflow/${workflow.id}`
      : !exact(value, ['id', 'name', 'active', 'availableInMCP']) ||
        value.id !== workflow.id ||
        value.name !== workflow.workflow.name ||
        value.active !== false ||
        value.availableInMCP !== false
  )
    fail();
  if (
    append({
      event: browserUi ? 'browser_port_preflight_verified' : 'native_port_preflight_verified',
      workflowId: workflow.id,
      ...(browserUi ? { kind: 'browser_ui' } : { active: false, availableInMCP: false }),
      at: new Date(now()).toISOString(),
    }) !== undefined
  )
    fail();
  return Object.freeze({
    ...(browserUi ? { browserControlVerified: true } : { metadataVerified: true }),
    executionsStarted: 0,
  });
}
export function projectFoundationNativeFailureDiagnostic(reader) {
  try {
    const d = reader?.lastFailure?.();
    if (
      !exact(d, ['version', 'workflowKey', 'operation', 'stage', 'classification', 'code', 'httpStatus']) ||
      d.version !== 1 ||
      (d.workflowKey !== null && !Object.hasOwn(foundationRuntimeCheckpoint.workflows, d.workflowKey)) ||
      !['unknown', 'discovery', 'metadata', 'workflow'].includes(d.operation) ||
      ![
        'unknown',
        'admission',
        'request',
        'framing',
        'body',
        'parse',
        'projection',
        'close',
        'http_status',
      ].includes(d.stage) ||
      !['unknown', 'contract', 'http', 'timeout', 'closure', 'confidentiality', 'parse', 'framing'].includes(
        d.classification,
      ) ||
      !foundationNativeFailureCodes.includes(d.code) ||
      (d.httpStatus !== null && (!Number.isInteger(d.httpStatus) || d.httpStatus < 100 || d.httpStatus > 599))
    )
      return {};
    return {
      code: 'FOUNDATION_NATIVE_' + d.code,
      nativeReaderWorkflowKey: d.workflowKey,
      nativeReaderStage: d.stage,
      nativeReaderHttpStatus: d.httpStatus,
    };
  } catch {
    return {};
  }
}

export function projectFoundationBaselineDiagnostic(runtime) {
  try {
    const value = runtime?.diagnostics?.();
    if (
      !exact(value, ['version', 'workflowKey', 'failedChecks', 'components']) ||
      value.version !== 1 ||
      !Object.hasOwn(foundationRuntimeCheckpoint.workflows, value.workflowKey) ||
      !Array.isArray(value.failedChecks) ||
      value.failedChecks.length > foundationRuntimeBaselineFailureCodes.length ||
      value.failedChecks.some((code) => !foundationRuntimeBaselineFailureCodes.includes(code)) ||
      !exact(value.components, ['nameEqual', 'nodesEqual', 'connectionsEqual', 'settingsEqual']) ||
      Object.values(value.components).some((v) => typeof v !== 'boolean')
    )
      return {};
    return {
      baselineWorkflowKey: value.workflowKey,
      baselineFailureCodes: [...new Set(value.failedChecks)],
      baselineNameEqual: value.components.nameEqual,
      baselineNodesEqual: value.components.nodesEqual,
      baselineConnectionsEqual: value.components.connectionsEqual,
      baselineSettingsEqual: value.components.settingsEqual,
    };
  } catch {
    return {};
  }
}
const setupFailureStages = new Set([
  'not_started',
  'starting',
  'native_exit',
  'utf8',
  'framing',
  'json',
  'completed',
  'stdout_limit',
  'stderr_limit',
  'child_error',
  'timeout',
  'aborted',
  'spawn_error',
]);
const setupFailureCodes = new Set([
  'unknown',
  'saved_auth_missing',
  'saved_auth_expired',
  'saved_auth_invalid_expiry',
  'auxiliary_scope_refusal',
  'auth_refresh_refused',
  'no_retry_bootstrap',
  'local_write_refused',
  'credential_storage_write_refused',
  'credential_storage_unsupported',
  'tls_failure',
  'dns_failure',
  'network_failure',
  'http_failure',
  'nondefault_bypass_prerequisite',
]);
// Preserve only fixed technical fields from the private CLI transport. Neither
// its stderr/output/error nor byte counts, paths or provider values are copied.
// False flags in the unknown projection mean closure/start/abort is unproven.
function projectSetupFailureDiagnostic(transport, setup) {
  const unknown = Object.freeze({
    stage: 'unknown',
    code: 'unknown',
    httpStatus: null,
    nativeExit: null,
    childStarted: false,
    childClosed: false,
    aborted: false,
  });
  try {
    const dto = transport?.diagnostics?.();
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return unknown;
    const { stage, code, httpStatus, nativeExit, childStarted, childClosed, aborted } = dto;
    if (
      !setupFailureStages.has(stage) ||
      typeof code !== 'string' ||
      !(httpStatus === null || (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599)) ||
      !(
        nativeExit === null ||
        (Number.isInteger(nativeExit) && nativeExit >= -2147483648 && nativeExit <= 2147483647)
      ) ||
      [childStarted, childClosed, aborted].some((v) => typeof v !== 'boolean')
    )
      return unknown;
    return Object.freeze({
      stage,
      code:
        setup?.snapshot?.().prerequisiteCode === 'nondefault_bypass_prerequisite'
          ? 'nondefault_bypass_prerequisite'
          : setupFailureCodes.has(code)
            ? code
            : 'unknown',
      httpStatus,
      nativeExit,
      childStarted,
      childClosed,
      aborted,
    });
  } catch {
    return unknown;
  }
}
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const selected = new Map(
  foundationAcceptancePlan()
    .cases.filter((c) => c.recommendedLive)
    .map((c) => [c.id, c]),
);

const replayCountKeys = Object.freeze([
  'items',
  'rawSnapshots',
  'aiExtractQueue',
  'embedQueue',
  'mediaQueue',
  'costEntries',
]);
const replayHashKeys = Object.freeze(['itemsSha256', 'rawSnapshotsSha256', 'queuesSha256', 'costsSha256']);
const replayKeys = Object.freeze([...replayCountKeys, ...replayHashKeys]);
function checkedReplaySnapshot(value) {
  try {
    if (!exact(value, replayKeys) || Reflect.ownKeys(value).length !== replayKeys.length) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value),
      normalized = {};
    for (const key of replayKeys) {
      const d = descriptors[key];
      if (!d || !Object.hasOwn(d, 'value')) fail();
      const v = d.value;
      if (
        replayCountKeys.includes(key)
          ? !Number.isSafeInteger(v) || v < 0
          : typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)
      )
        fail();
      normalized[key] = v;
    }
    return Object.freeze(normalized);
  } catch {
    fail();
  }
}
export function verifyFoundationLiveReplaySnapshots(before, after) {
  const a = checkedReplaySnapshot(before),
    b = checkedReplaySnapshot(after);
  if (replayKeys.some((key) => a[key] !== b[key])) fail();
  return true;
}
export async function verifyFoundationLiveCallbackSqlCase({
  caseId,
  readSnapshot,
  start,
  cleanup,
  append,
  now = Date.now,
} = {}) {
  if (
    ![
      'callback.unknown',
      'callback.equal_replay',
      'callback.concurrent_pair',
      'callback.recovery_drill',
    ].includes(caseId) ||
    [readSnapshot, start, cleanup, append, now].some((fn) => typeof fn !== 'function')
  )
    fail();
  let before, r;
  try {
    // Validate before invoking a callback transport/native admission. Undefined
    // or equal malformed values are never evidence of a no-op.
    before = checkedReplaySnapshot(await readSnapshot());
    r = await start();
    if (
      !r ||
      r.caseId !== caseId ||
      !Array.isArray(r.executionIds) ||
      r.executionIds.length > 120 ||
      r.executionIds.some((id) => typeof id !== 'string' || !/^[1-9][0-9]{0,31}$/.test(id))
    )
      fail();
  } catch {
    fail();
  }
  const result = (status) => ({
    status,
    caseId,
    executionIds: [...r.executionIds],
    residual: status !== 'native_settled_and_cleaned',
  });
  if (r.state !== 'native_settled') return result('native_unresolved');
  let sqlVerified = false;
  try {
    verifyFoundationLiveReplaySnapshots(before, await readSnapshot());
    const written = append({
      event: 'callback_replay_sql_parity_verified',
      caseId,
      countsUnchanged: true,
      hashesUnchanged: true,
      at: new Date(now()).toISOString(),
    });
    if (written !== undefined) {
      if (written && typeof written.then === 'function') Promise.resolve(written).catch(() => {});
      fail();
    }
    sqlVerified = true;
  } catch {
    /* SQL/evidence failure does not skip cleanup of settled native work. */
  }
  let cleaned = false;
  try {
    cleaned = (await cleanup(caseId)) === true;
  } catch {
    /* Fixed residual classification only. */
  }
  if (!sqlVerified) return result('sql_acceptance_unresolved');
  return result(cleaned ? 'native_settled_and_cleaned' : 'cleanup_unresolved');
}

// Fixed post-settlement SQL assertion: no actor, new input, price, SQL string or
// provider ID can be supplied independently of the genuine native/SQL proof.
export async function verifyFoundationLiveSmokeSql({
  caseId,
  receipts,
  settlement,
  admin,
  append,
  now = Date.now,
  activeWindowId = windowId,
}) {
  const proof = assertFoundationSettlementReceipt(settlement);
  if (
    ![
      windowId,
      '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      'eda4fae1-1e19-47db-81b8-beac1a4ed883',
      '3c46c791-e140-4eb9-890a-eecfa251f65e',
      '4c602549-2c42-4ec3-9328-714d7cb66a77',
      'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
      'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
    ].includes(activeWindowId) ||
    proof.windowId !== activeWindowId ||
    !['smoke.first', 'smoke.second'].includes(caseId) ||
    proof.caseId !== caseId ||
    !Array.isArray(receipts) ||
    receipts.length < 1 ||
    typeof append !== 'function'
  )
    fail();
  const ids = receipts.map((r) => assertFoundationNativeReceipt(r).executionId);
  if (
    new Set(ids).size !== ids.length ||
    JSON.stringify([...ids].sort()) !== JSON.stringify([...proof.executionIds].sort())
  )
    fail();
  const s = await admin.readGateway({
    query: foundationSettlementQuery,
    params: [activeWindowId, [], ids, '[]'],
  });
  const p = s?.providers?.[0],
    expected = caseId === 'smoke.first' ? 1 : 0,
    original = proof.providerRunIds;
  if (
    s?.window_id !== activeWindowId ||
    !Array.isArray(s.providers) ||
    s.providers.length !== 1 ||
    original.length !== 1 ||
    p?.registry?.apify_run_id !== original[0] ||
    p.launch?.apify_run_id !== original[0] ||
    p.launch?.run_id !== p.registry.run_id ||
    p.launch?.ordinal !== (expected === 1 ? 1 : 2)
  )
    fail();
  const a = await admin.smokeAssert({
    runId: p.registry.run_id,
    apifyRunId: original[0],
    expectedItemsNew: expected,
  });
  if (
    a?.result !== 'M03_SMOKE_SQL_STATE_PASS' ||
    a.run_id !== p.registry.run_id ||
    a.apify_run_id !== original[0] ||
    a.expected_items_new !== expected ||
    a.webhook_delivery_or_replay_proven !== false
  )
    fail();
  append({
    event: 'smoke_sql_state_verified',
    caseId,
    runId: p.registry.run_id,
    apifyRunId: original[0],
    expectedItemsNew: expected,
    at: new Date(now()).toISOString(),
  });
}

export function createFoundationLiveAcceptanceSession(input, emit, dependencies = {}) {
  let budget;
  try {
    return constructFoundationLiveAcceptanceSession(input, emit, dependencies, (opened) => {
      budget = opened;
    });
  } catch (error) {
    // A constructor refusal has no session.close() owner. Preserve the first
    // error and let the genuine budget retain its lock if transports are open.
    try {
      budget?.close();
    } catch {
      /* Cleanup cannot replace the original refusal or claim closure. */
    }
    throw error;
  }
}

function constructFoundationLiveAcceptanceSession(input, emit, dependencies, openedBudget) {
  const now = dependencies.now ?? Date.now;
  const resume =
    dependencies.zeroSetupProof === undefined
      ? null
      : assertFoundationLiveZeroSetupProof(dependencies.zeroSetupProof);
  const amendment =
    dependencies.clockAmendmentProof === undefined
      ? null
      : assertFoundationLiveClockAmendmentProof(dependencies.clockAmendmentProof, { claimed: true });
  const previousContinuation =
    dependencies.postcheckContinuationProof === undefined
      ? null
      : assertFoundationLivePostcheckContinuationProof(dependencies.postcheckContinuationProof, {
          claimed: true,
        });
  const remaining =
    dependencies.remainingContinuationProof === undefined
      ? null
      : assertFoundationLiveRemainingContinuationProof(dependencies.remainingContinuationProof, {
          claimed: true,
        });
  const startup =
    dependencies.startupReplacementProof === undefined
      ? null
      : assertFoundationLiveStartupReplacementProof(dependencies.startupReplacementProof, { claimed: true });
  const verified =
    dependencies.projectVerifiedContinuationProof === undefined
      ? null
      : assertFoundationLiveProjectVerifiedContinuationProof(dependencies.projectVerifiedContinuationProof, {
          claimed: true,
        });
  if ([resume, amendment, previousContinuation, remaining, startup, verified].filter(Boolean).length > 1)
    fail();
  const continuation = verified || startup || remaining || previousContinuation;
  const verifiedCheckpoint = verified
    ? foundationProjectVerifiedContinuationResumeCheckpoint(verified)
    : null;
  const unadmittedUsage = verified
    ? foundationProjectVerifiedContinuationUnadmittedUsage(verified)
    : { nativeExecutions: 0, gatewayHttpAttempts: 0 };
  const restoredBaselineScope = [1024, 1408, 1728].includes(verifiedCheckpoint?.managementMaximum)
    ? { projectVerifiedContinuationProof: verified }
    : {};
  const activeWindowId = verified?.windowId ?? windowId;
  const admittedClock = continuation || amendment;
  if (
    !exact(input, [
      'kind',
      'version',
      'approvedHead',
      'approvedPacketSha256',
      'sourceCommitSha',
      'managementKey',
      'writerPassword',
      'apifyReadToken',
      'machineToken',
      'protectionBypass',
      'leaseExpiry',
    ]) ||
    input.kind !== 'm03_acceptance_private_input' ||
    input.version !== 1 ||
    input.approvedHead !== approvedHead ||
    input.approvedPacketSha256 !== approvedPacketSha256 ||
    !/^[a-f0-9]{40}$/.test(input.sourceCommitSha) ||
    !Number.isSafeInteger(input.leaseExpiry) ||
    input.leaseExpiry < now() + 3600000 ||
    input.leaseExpiry > now() + 7260000 ||
    ['managementKey', 'writerPassword', 'apifyReadToken'].some(
      (k) => typeof input[k] !== 'string' || !input[k] || input[k].length > 4096,
    ) ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.machineToken) ||
    !/^[A-Za-z0-9]{32}$/.test(input.protectionBypass) ||
    typeof emit !== 'function'
  )
    fail();
  if (resume && (resume.sourceCommitSha !== input.sourceCommitSha || now() >= resume.stopNewAt)) fail();
  if (continuation && input.leaseExpiry < continuation.startsAt + 4500000) fail();
  if (
    admittedClock &&
    (admittedClock.sourceCommitSha !== input.sourceCommitSha ||
      now() < admittedClock.startsAt ||
      now() >= admittedClock.stopNewAt)
  )
    fail();
  const deadlineAt = admittedClock ? admittedClock.deadlineAt : resume ? resume.deadlineAt : now() + 3600000;
  let controlBudget;
  const budget = createFoundationLiveManagementBudget(
    { sourceCommitSha: input.sourceCommitSha, deadlineAt },
    {
      ...(dependencies.storage ?? {}),
      now,
      ...(resume ? { zeroSetupProof: resume } : {}),
      ...(amendment ? { clockAmendmentProof: amendment } : {}),
      ...(previousContinuation ? { postcheckContinuationProof: previousContinuation } : {}),
      ...(remaining ? { remainingContinuationProof: remaining } : {}),
      ...(startup ? { startupReplacementProof: startup } : {}),
      ...(verified ? { projectVerifiedContinuationProof: verified } : {}),
      ...([576, 640, 704, 832, 1024, 1408, 1728].includes(verifiedCheckpoint?.managementMaximum)
        ? {
            controlAttempts: () =>
              controlBudget?.snapshot().attempts ?? verifiedCheckpoint.aggregateControlAttempts,
          }
        : {}),
    },
  );
  openedBudget(budget);
  if (
    (resume || admittedClock) &&
    budget.snapshot().attempts !==
      (verified ? verifiedCheckpoint.aggregateManagementAttempts : startup || remaining ? 4 : 0)
  ) {
    budget.close();
    fail();
  }
  const ownerPreflight = foundationLiveAuxiliaryStorage(budget, 'preflight');
  if (ownerPreflight.previousEvents.length !== (verified ? verifiedCheckpoint.preflightRows : 0)) {
    budget.close();
    fail();
  }
  const nativeStorage = foundationLiveAuxiliaryStorage(budget, 'control');
  if ((resume || amendment) && nativeStorage.previousEvents.length) {
    budget.close();
    fail();
  }
  if (verified) {
    try {
      assertFoundationProjectVerifiedContinuationControlResume(verified, {
        deadlineAt,
        previousEvents: nativeStorage.previousEvents,
      });
    } catch {
      budget.close();
      fail();
    }
  }
  if (
    continuation &&
    !verified &&
    (nativeStorage.previousEvents.length !== (startup ? 150 : remaining ? 100 : 50) ||
      nativeStorage.previousEvents.some(
        (row, index) =>
          row.event !== 'control_request_intent' || row.kind !== 'discovery' || row.ordinal !== index + 1,
      ))
  ) {
    budget.close();
    fail();
  }
  const controlJournal = createFoundationControlJournal({
    previousEvents: nativeStorage.previousEvents,
    durableAppend: nativeStorage.append,
  });
  controlBudget = createFoundationControlBudget({
    journal: controlJournal,
    now,
    deadlineAt,
    ...(remaining ? { remainingContinuationProof: remaining } : {}),
    ...(startup ? { startupReplacementProof: startup } : {}),
    ...(verified ? { projectVerifiedContinuationProof: verified } : {}),
    ...([576, 640, 704, 832, 1024, 1408, 1728].includes(verifiedCheckpoint?.managementMaximum)
      ? { managementAttempts: () => budget.snapshot().attempts }
      : {}),
  });
  if (
    continuation &&
    controlBudget.snapshot().attempts !==
      (verified ? verifiedCheckpoint.aggregateControlAttempts : startup ? 151 : remaining ? 101 : 50)
  ) {
    budget.close();
    fail();
  }
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const transport = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const records = Object.keys(bindings.workflowRefs).map((k) =>
    JSON.parse(readFileSync(new URL('../../n8n/workflows/' + k + '.json', import.meta.url))),
  );
  const bridge = createFoundationLiveMcpBridge({
    bindings,
    emit,
    deadlineAt,
    now,
    executionSource: verifiedCheckpoint?.closedWindow ? 'browser_ui' : 'mcp',
  });
  let runtime,
    setup,
    admin,
    native,
    reader,
    cleanup,
    provider,
    gateway,
    writerCloser,
    baselinePreflight,
    baselinePreflightReceipt,
    nativeTransport,
    fixture,
    preflight,
    deployment;
  let busy = false,
    prepared = false,
    preparing = false,
    provisionAttempted = false,
    windowClosed = false,
    archived = false,
    failed = false;
  let gatewayAttempts = verifiedCheckpoint?.gatewayPreflightAttempts ?? 0,
    providerAttempts = 0,
    domainProof = null,
    latest = new Map(),
    closed = false;
  let baselineRestored = false,
    environmentCleanupVerified = false;
  let baselineIdsByKey = null,
    finalOwnedSweepClean = false,
    remoteWorkSettled = false;
  let closeAttempted = false,
    archiveAttempted = false,
    sweepAttempted = false,
    inventoryAttempted = false,
    providerInventoryVerified = true;
  let physicalClosed = false,
    shutdownResult;
  let adminPhysicalClosed = true;
  let adminStartupFailure = null;
  let preparationStage = null;
  let nativeMetadataFailure = false;
  let adminLifecycleVerified = true,
    adminEndAttempted = false;
  const attemptedCaseIds = new Set(),
    stopAttemptedIds = new Set();
  const sourceSecrets = [
    input.managementKey,
    input.writerPassword,
    input.apifyReadToken,
    input.machineToken,
    input.protectionBypass,
  ];
  budget.attachTransport({
    state: () => ({
      pendingRequests: adminPhysicalClosed ? 0 : 1,
      unclosedResponses: adminPhysicalClosed ? 0 : 1,
    }),
    close() {},
  });
  const result = (status, extra = {}) => ({
    status,
    managementAttempts: budget.snapshot().attempts,
    controlAttempts: controlBudget.snapshot().attempts,
    nativeExecutions: native?.snapshot().nativeExecutions ?? unadmittedUsage.nativeExecutions,
    gatewayPreflightAttempts: gatewayAttempts,
    providerDirectAttempts: providerAttempts,
    phaseBReady: native?.snapshot().phaseBReady ?? false,
    domainProofReady: domainProof !== null,
    businessAcceptanceProven: false,
    ...(failed && preparationStage ? { code: 'FOUNDATION_' + preparationStage + '_BLOCKED' } : {}),
    ...(adminStartupFailure
      ? { code: 'FOUNDATION_ADMIN_' + adminStartupFailure.diagnostic.toUpperCase() }
      : {}),
    ...(nativeMetadataFailure
      ? {
          code:
            bridge.port.source === 'browser_ui'
              ? 'FOUNDATION_NATIVE_UI_BLOCKED'
              : 'FOUNDATION_NATIVE_METADATA_BLOCKED',
        }
      : {}),
    ...projectFoundationBaselineDiagnostic(runtime ?? baselinePreflight),
    ...projectFoundationNativeFailureDiagnostic(reader),
    ...extra,
  });
  const bindingFor = (key) =>
    runtime.bindingFor(key, latest.has(key) ? { caseReceipt: latest.get(key) } : {});
  function append(row) {
    controlJournal.append(row);
  }
  function composeReader() {
    if (reader) return;
    nativeTransport = (dependencies.createNativeTransport ?? createFoundationNativeTransport)(
      {
        apiKey: input.managementKey,
        bindings,
        authorizeExecution: (args) => native?.authorizeExecution(args) === true,
      },
      dependencies.nativeTransport ?? {},
    );
    budget.attachTransport(nativeTransport);
    reader = createFoundationNativeReader({
      bindings,
      transport: nativeTransport,
      admitControlAttempt: (args) => controlBudget.admit(args),
      now,
      deadlineAt,
      sensitiveValues: sourceSecrets,
    });
  }
  function composeNative() {
    composeReader();
    provider = createFoundationLiveProviderReader(
      {
        token: input.apifyReadToken,
        deadlineAt,
        admitProviderAttempt() {
          //20 is the immutable selected workflow read upper allocation; these
          // +2 optional original acquisition is reserved too:22+10=32 total.
          if (providerAttempts >= 10 || now() >= deadlineAt) fail();
          append({
            event: 'provider_read_intent',
            ordinal: providerAttempts + 1,
            at: new Date(now()).toISOString(),
          });
          providerAttempts++;
        },
      },
      dependencies.providerTransport ?? {},
    );
    budget.attachTransport(provider);
    const settlementReader = createFoundationSettlementReader({
      windowId: activeWindowId,
      readGateway: (args) => admin.readGateway(args),
      readProvider: (args) => provider.read(args),
      transportSnapshot: () => ({
        ...nativeTransport.state(),
        pendingProviderRequests: provider.state().pendingRequests,
        pendingGatewayRequests: admin.state().requestPending ? 1 : 0,
      }),
      now,
      pause,
      deadlineAt,
    });
    const callbackCases = createFoundationCallbackCases({
      readUnknown: (args) => admin.readUnknown(args),
      now,
      deadlineAt,
    });
    return { settlementReader, callbackCases };
  }
  async function prepare() {
    if (preparing || prepared || closed) fail();
    preparing = true;
    // Twenty-five source-only GETs precede all owner DB/Preview/fixture writes.
    // Reuse this actual25-read proof in runtime setup, and its own final25
    // restoration audit, retaining every fresh per-write GET/PUT/GET.
    // 110setup +24drafts*3 +2Machine reads +124restore =308.
    if (budget.snapshot().attempts + 25 + 44 + 308 > budget.snapshot().maximum) fail();
    if (verifiedCheckpoint?.closedWindow) {
      nativeMetadataFailure = true;
      await verifyFoundationLiveNativeMetadata({
        port: bridge.port,
        workflow: records.find((record) => record.key === 'WF-00'),
        admit: (args) => controlBudget.admit(args),
        append,
        now,
      });
      nativeMetadataFailure = false;
    }
    baselinePreflight = (dependencies.createBaselinePreflight ?? createFoundationLiveBaselinePreflight)(
      {
        bindings,
        records,
        apiKey: input.managementKey,
        deadlineAt,
        admitManagementAttempt: () => budget.admit(),
        managementBudget: budget,
        ...restoredBaselineScope,
      },
      dependencies.baselineTransport ?? {},
    );
    budget.attachTransport(baselinePreflight);
    baselinePreflightReceipt = await baselinePreflight.read();
    if (
      assertFoundationLiveBaselineReceipt(baselinePreflightReceipt, {
        baseline: createFoundationRuntimeBaseline({
          bindings,
          records,
          ...restoredBaselineScope,
        }),
        deadlineAt,
        ...restoredBaselineScope,
        managementBudget: budget,
      }).verifiedWorkflows !== 25
    )
      fail();
    composeReader();
    baselineIdsByKey = {};
    for (const key of Object.keys(bindings.workflowRefs)) {
      const scan = await reader.discover({ workflowKey: key, baselineIds: [] });
      if (scan.paginationComplete !== true) fail();
      baselineIdsByKey[key] = scan.candidates.map((v) => v.executionId);
    }
    adminPhysicalClosed = false;
    adminLifecycleVerified = false;
    preparationStage = 'ADMIN_CLIENT';
    try {
      admin = await (dependencies.startAdmin ?? startFoundationAdminClient)({
        repositoryRoot,
        now,
        ...(resume ? { originalDeadlineAtMs: resume.deadlineAt } : {}),
        ...(amendment ? { clockAmendmentProof: amendment } : {}),
        ...(previousContinuation ? { postcheckContinuationProof: previousContinuation } : {}),
        ...(remaining ? { remainingContinuationProof: remaining } : {}),
        ...(startup ? { startupReplacementProof: startup } : {}),
        ...(verified ? { projectVerifiedContinuationProof: verified } : {}),
        ...(verified && activeWindowId !== windowId ? { forwardWindow: true } : {}),
      });
    } catch (error) {
      adminStartupFailure = readFoundationAdminStartupFailure(error);
      // A rejected startup does not return an Admin client. Preserve genuine
      // physical closure only when no credential-bearing child could exist;
      // a generic error or an unclosed child still leaves the sentinel open.
      if (
        adminStartupFailure?.physicalChildClosed === true &&
        (adminStartupFailure.childSpawned === false ||
          (adminStartupFailure.dpapiRead === 'not_attempted' &&
            adminStartupFailure.authentication === 'not_attempted'))
      ) {
        adminPhysicalClosed = true;
        adminLifecycleVerified = true;
      }
      throw error;
    }
    preparationStage = null;
    const ready = await admin.postcheck();
    if (
      ready?.ready !== true ||
      ready.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      ready.migrationCount !== (activeWindowId === windowId ? 14 : 15)
    )
      fail();
    if (activeWindowId === windowId) fixture = await admin.fixture();
    preflight = await admin.preflight();
    preparationStage = 'PREFLIGHT_CONTRACT';
    if (
      preflight?.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      preflight.dailyBudgetUsd !== 25 ||
      preflight.statsDailyEnabled !== false ||
      preflight.errorCount24h !== 0 ||
      preflight.notificationCooldownClear !== true ||
      !preflight.priceBook ||
      typeof preflight.priceBook !== 'object' ||
      !Object.keys(preflight.priceBook).length
    )
      fail();
    preparationStage = 'SETUP_JOURNAL';
    const storage = foundationLiveAuxiliaryStorage(budget, 'setup');
    const setupJournal = createFoundationLiveSetupJournal({
      sourceCommitSha: input.sourceCommitSha,
      previousEvents: storage.previousEvents,
      durableAppend: storage.append,
      maximumRequests: verifiedCheckpoint?.setupMaximum ?? 50,
    });
    let t;
    preparationStage = 'SETUP_TRANSPORT';
    t = (dependencies.createSetupTransport ?? createFoundationLiveSetupCliTransport)({
      nodeExecutable: process.execPath,
      cliPath: join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/index.js'),
      noRetryPreloadPath: join(repositoryRoot, 'scripts/n8n/foundation-live-setup-no-retry.mjs'),
      workingDirectory: repositoryRoot,
      now,
      deadlineAt,
      authorizeRequest: (spec) => setup?.authorizeRequest(spec) === true,
    });
    preparationStage = 'SETUP_CONSTRUCTOR';
    setup = (dependencies.createSetup ?? createFoundationLiveSetup)(
      {
        sourceCommitSha: input.sourceCommitSha,
        activeWindowId,
        transport: t,
        journal: setupJournal,
        managementBudget: budget,
        ...(remaining ? { remainingContinuationProof: remaining } : {}),
        ...(startup ? { startupReplacementProof: startup } : {}),
        ...(verified ? { projectVerifiedContinuationProof: verified } : {}),
        now,
        deadlineAt,
        pause,
        verifyDevReady: async () => ready,
        sensitive: {
          writerPassword: input.writerPassword,
          machineToken: input.machineToken,
          apifyReadToken: input.apifyReadToken,
          protectionBypass: input.protectionBypass,
        },
      },
      dependencies.setup ?? {},
    );
    preparationStage = null;
    try {
      deployment = (dependencies.assertDeployment ?? assertFoundationLiveDeployment)(await setup.prepare());
    } catch {
      const diagnostic = projectSetupFailureDiagnostic(t, setup);
      ownerPreflight.append({
        event: 'setup_failure_diagnostic',
        at: new Date(now()).toISOString(),
        ...diagnostic,
      });
      fail();
    }
    preparationStage = 'WRITER_CLOSER';
    writerCloser = (dependencies.createWriterCloser ?? createFoundationLiveWriterCloser)(
      {
        windowId: activeWindowId,
        password: input.writerPassword,
        audience: deployment.audience,
        sourceCommitSha: input.sourceCommitSha,
        deploymentId: deployment.deploymentId,
        deadlineAt,
        previousEvents: ownerPreflight.previousEvents,
        append: ownerPreflight.append,
      },
      dependencies.writerTransport ?? {},
    );
    budget.attachTransport(writerCloser);
    preparationStage = null;
    provisionAttempted = true;
    const provision = await admin.provision({
      audience: deployment.audience,
      commitSha: input.sourceCommitSha,
      deploymentId: deployment.deploymentId,
    });
    if (
      provision?.windowId !== activeWindowId ||
      provision.boundAudience !== deployment.audience ||
      provision.boundCommitSha !== input.sourceCommitSha ||
      provision.boundDeploymentId !== deployment.deploymentId ||
      provision.started !== false ||
      provision.closed !== false ||
      provision.totalAdmitted !== 0 ||
      provision.approvalCount !== 1
    )
      fail();
    if (activeWindowId !== windowId) fixture = await admin.fixture();
    // The first authorized probe is constructed only after the real SQL binding.
    // Its transport and actual identity response supply these plan flags; the
    // deployment DTO's earlier false fields are never blindly promoted.
    let expectedIdentityRequestId;
    gateway = (dependencies.createGatewayProbe ?? createFoundationLiveGatewayProbe)(
      {
        audience: deployment.audience,
        machineToken: input.machineToken,
        protectionBypass: input.protectionBypass,
        deadlineAt,
        admitGatewayAttempt({ requestId, unauthorized }) {
          if (gatewayAttempts >= 24 || now() >= deadlineAt) fail();
          ownerPreflight.append({
            event: 'gateway_probe_intent',
            ordinal: gatewayAttempts + 1,
            requestId,
            unauthorized,
            operation: 'identity.read',
            audience: deployment.audience,
            at: new Date(now()).toISOString(),
          });
          gatewayAttempts++;
          if (!unauthorized) expectedIdentityRequestId = requestId;
        },
      },
      dependencies.gatewayTransport ?? {},
    );
    budget.attachTransport(gateway);
    const identity = await gateway.identity();
    const r = identity?.body,
      i = r?.result,
      w = r?.window;
    if (
      identity.status !== 200 ||
      !exact(r, ['version', 'requestId', 'outcome', 'operation', 'replayed', 'result', 'window']) ||
      r.version !== 1 ||
      r.requestId !== expectedIdentityRequestId ||
      r.outcome !== 'completed' ||
      r.operation !== 'identity.read' ||
      r.replayed !== false ||
      !exact(i, ['currentUser', 'sessionUser', 'database', 'projectRef', 'connectionCount']) ||
      i?.currentUser !== 'n8n_writer' ||
      i.sessionUser !== 'n8n_writer' ||
      i.database !== 'postgres' ||
      i.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      !Number.isSafeInteger(i.connectionCount) ||
      i.connectionCount < 1 ||
      i.connectionCount > 5 ||
      !exact(w, [
        'id',
        'startsAt',
        'expiresAt',
        'closed',
        'totalAdmitted',
        'boundAudience',
        'boundCommitSha',
        'boundDeploymentId',
      ]) ||
      !Number.isSafeInteger(w.totalAdmitted) ||
      w.totalAdmitted < 1 ||
      w.totalAdmitted > 256 ||
      typeof w.startsAt !== 'string' ||
      typeof w.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(w.startsAt)) ||
      !Number.isFinite(Date.parse(w.expiresAt)) ||
      Date.parse(w.startsAt) > now() + 30000 ||
      Date.parse(w.expiresAt) <= now() ||
      Date.parse(w.expiresAt) <= Date.parse(w.startsAt) ||
      Date.parse(w.expiresAt) - Date.parse(w.startsAt) > 3600000 ||
      w?.id !== activeWindowId ||
      w.closed !== false ||
      w.boundAudience !== deployment.audience ||
      w.boundCommitSha !== input.sourceCommitSha ||
      w.boundDeploymentId !== deployment.deploymentId
    )
      fail();
    if (![401, 403].includes((await gateway.identity({ unauthorized: true })).status)) fail();
    ownerPreflight.append({
      event: 'gateway_probe_verified',
      identityVerified: true,
      unauthorizedVerified: true,
      audience: deployment.audience,
      at: new Date(now()).toISOString(),
    });
    runtime = createFoundationLiveRuntime(
      {
        bindings,
        transport,
        records,
        activeWindowId,
        setup: { ...deployment, protectionTransportVerified: true, sqlAudienceBindingVerified: true },
        ...restoredBaselineScope,
        managementKey: input.managementKey,
        machineToken: input.machineToken,
        protectionBypass: input.protectionBypass,
        deadlineAt,
      },
      {
        managementBudget: budget,
        controlJournal,
        controlBudget,
        now,
        ...(dependencies.runtime ?? {}),
        baselinePreflightReceipt,
      },
    );
    preparationStage = 'RUNTIME_SETUP';
    if ((await runtime.setup()).status !== 'runtime_setup_verified') fail();
    preparationStage = null;
    const ports = composeNative();
    native = createFoundationExecutionController({
      activeWindowId,
      ...(unadmittedUsage.nativeExecutions > 0 ? { projectVerifiedContinuationProof: verified } : {}),
      bindings,
      port: bridge.port,
      journal: runtime.controlJournal,
      nativeReader: reader,
      bindingFor,
      settlementReader: ports.settlementReader,
      nativeTransport,
      controlBudget,
      baselineIdsByKey,
      callbackCases: ports.callbackCases,
      now,
      pause,
    });
    cleanup = createFoundationNativeCleanup({
      reader,
      transport: nativeTransport,
      admitControlAttempt: (args) => controlBudget.admit(args),
      journal: controlJournal,
      now,
      deadlineAt,
    });
    prepared = true;
    preparing = false;
    return result('dev_runtime_prepared');
  }
  async function cleanupCase(caseId) {
    const closure = native.caseClosure(caseId);
    if (!closure) return false;
    for (const receipt of native.caseReceipts(caseId)) {
      const proof = await cleanup.cleanup({ receipt, closure });
      if (proof.state !== 'native_record_deleted') return false;
      native.recordCleanup(proof);
    }
    return true;
  }
  async function firstOriginalEvidence() {
    const original = await admin.firstOriginalContext();
    const d = original?.datasetRead;
    if (
      !d ||
      !Array.isArray(d.rows) ||
      d.rows.length !== 1 ||
      d.transport?.requests !== 2 ||
      d.transport.retries !== 0 ||
      d.transport.socketsClosed !== true ||
      d.transport.runBytesMax !== 65536 ||
      d.transport.datasetBytesMax !== 262144
    )
      fail();
    const shared = require('../../n8n/normalizers/smoke_website_stub.js');
    const { createM03SmokeWebsiteNormalizer } = require('../../n8n/normalizers/smoke_website_m03.js');
    const normalize = createM03SmokeWebsiteNormalizer(
      shared.validateSmokeWebsiteRow,
      shared.buildSmokeWebsiteSnapshot,
      shared.invalidWebsiteRow,
    );
    const t = createApifyRecoveryRuntime().validateTerminal(d.terminal),
      r = original.registered;
    const atomicInput = {
      p_apify_run_id: r.apify_run_id,
      p_status: t.status,
      p_dataset_id: t.datasetId,
      p_usage_usd: t.usageTotalUsd,
      p_groups: [
        {
          account_id: r.account_ids[0],
          normalizer_version: 'smoke_website_stub.v1',
          items: [normalize(d.rows[0]).json],
        },
      ],
    };
    createApifyRecoveryRuntime().validateReceipt(r.processing_result, r, atomicInput);
    if ((await admin.verifyAtomicInput({ atomicInput }))?.matched !== true) fail();
    return {
      source: 'bounded-original-dataset-read',
      readRequestId: original.readRequestId,
      launch: original.launch,
      registered: r,
      atomicInput,
      costEntry: original.costEntry,
    };
  }
  async function runCase(caseId) {
    const spec = selected.get(caseId);
    if (!prepared || !spec) fail();
    if (caseId.startsWith('smoke.') && (!native.snapshot().phaseBReady || domainProof === null)) fail();
    if (
      caseId.startsWith('smoke.') &&
      (await runtime.verifyMachine()).status !== 'owned_machine_metadata_unchanged'
    )
      fail();
    const options = {
      ...(spec.requiresFixtureReceipt ? { fixtureReceipt: fixture } : {}),
      ...(spec.requiresFirstRunEvidence ? { firstRunEvidence: await firstOriginalEvidence() } : {}),
      ...(caseId.startsWith('smoke.') ? { release: { launchEnabled: true } } : {}),
    };
    const receipt = await runtime.saveCase(caseId, options);
    if (receipt.status !== 'case_draft_verified') fail();
    latest.set(spec.workflowKey, receipt);
    const before = spec.requiresFirstRunEvidence ? checkedReplaySnapshot(await admin.replaySnapshot()) : null;
    attemptedCaseIds.add(caseId);
    const outcome = await native.runCase({
      caseId,
      workflowKey: spec.workflowKey,
      versionId: receipt.versionId,
      caseReceipt: receipt,
    });
    if (outcome.state !== 'native_settled') {
      failed = true;
      return result('native_unresolved', { caseId, executionIds: outcome.executionIds, residual: true });
    }
    let sqlVerified = true;
    try {
      if (before) {
        verifyFoundationLiveReplaySnapshots(before, await admin.replaySnapshot());
        const e = options.firstRunEvidence;
        ownerPreflight.append({
          event: 'sub_replay_sql_parity_verified',
          caseId,
          runId: e.registered.run_id,
          apifyRunId: e.registered.apify_run_id,
          readRequestId: e.readRequestId,
          countsUnchanged: true,
          hashesUnchanged: true,
          at: new Date(now()).toISOString(),
        });
      }
      if (caseId.startsWith('smoke.')) {
        await verifyFoundationLiveSmokeSql({
          activeWindowId,
          caseId,
          receipts: native.caseReceipts(caseId),
          settlement: native.caseSettlement(caseId),
          admin,
          append: ownerPreflight.append,
          now,
        });
      }
    } catch {
      sqlVerified = false;
      failed = true;
    }
    if (!(await cleanupCase(caseId))) {
      failed = true;
      return result('cleanup_unresolved', { caseId, residual: true });
    }
    if (!sqlVerified)
      return result('sql_acceptance_unresolved', {
        caseId,
        executionIds: outcome.executionIds,
        residual: true,
      });
    return result('native_settled_and_cleaned', { caseId, executionIds: outcome.executionIds });
  }
  async function runDomain() {
    if (!prepared || !native.snapshot().phaseBReady || domainProof !== null) fail();
    const receipt = await runtime.saveDomainProbe();
    if (receipt.status !== 'case_draft_verified') fail();
    latest.set('WF-99', receipt);
    attemptedCaseIds.add('control.machine_domain');
    const outcome = await native.runCase({
      caseId: 'control.machine_domain',
      workflowKey: 'WF-99',
      versionId: receipt.versionId,
      caseReceipt: receipt,
    });
    if (outcome.state !== 'native_settled' || !(await cleanupCase(outcome.caseId))) {
      failed = true;
      return result('domain_proof_unresolved', { residual: true });
    }
    const proof = native
      .caseReceipts(outcome.caseId)
      .find((r) => r.key === 'WF-99' && r.nativeDomainDenial?.httpRequestIssued === false);
    if (!proof) fail();
    domainProof = proof;
    return result('native_domain_denial_and_cleanup_verified', {
      caseId: outcome.caseId,
      executionIds: outcome.executionIds,
    });
  }
  function canArchiveUnprovisionedFixture() {
    return (
      continuation !== null &&
      !provisionAttempted &&
      runtime === undefined &&
      native === undefined &&
      attemptedCaseIds.size === 0 &&
      gatewayAttempts === 0 &&
      providerAttempts === 0 &&
      exact(fixture, [
        'result',
        'company_code',
        'competitor_id',
        'account_id',
        'platform',
        'url',
        'competitor_status',
        'account_status',
      ]) &&
      fixture.result === 'M03_SMOKE_FIXTURE_READY' &&
      fixture.company_code === 'C999' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(fixture.competitor_id) &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(fixture.account_id) &&
      fixture.platform === 'website_work_page' &&
      fixture.url === 'https://everyone.film/about-everyone' &&
      fixture.competitor_status === 'active' &&
      fixture.account_status === 'active'
    );
  }
  function acceptClosedAdminFixtureArchive(result, childClosed) {
    const receipt = result?.receipt;
    if (
      childClosed &&
      canArchiveUnprovisionedFixture() &&
      admin.ready?.postcheckContinuation === true &&
      typeof admin.ready.runId === 'string' &&
      admin.ready.runId.length > 0 &&
      admin.ready.clockSegmentId === continuation.segmentId &&
      receipt?.runId === admin.ready.runId &&
      receipt.clockSegmentId === continuation.segmentId &&
      receipt.postcheckContinuation === true &&
      receipt.unprovisionedFixtureArchived === true
    ) {
      archiveAttempted = true;
      archived = true;
    }
  }
  async function closeOwnedWindow() {
    if (!provisionAttempted || windowClosed) return;
    if (!closeAttempted) {
      closeAttempted = true;
      try {
        await writerCloser.closeWindow();
      } catch {
        /* A lost Writer acknowledgement permits only independent readback. */
      }
    }
    try {
      const r = await admin.close();
      windowClosed =
        exact(r, ['state', 'window']) &&
        r.state === 'closed' &&
        exact(r.window, ['id', 'closed']) &&
        r.window.id === activeWindowId &&
        r.window.closed === true;
    } catch {
      /* The owner SELECT cannot invent closure or repeat the Writer mutation. */
    }
  }
  async function restore() {
    native?.closeAdmission();
    for (const executionId of native?.snapshot().residualExecutionIds ?? []) {
      if (stopAttemptedIds.has(executionId)) continue;
      stopAttemptedIds.add(executionId);
      try {
        await native.stop({ executionId });
      } catch {
        /* A stop acknowledgement never promotes native settlement. */
      }
    }
    if (!inventoryAttempted && [...attemptedCaseIds].some((id) => id.startsWith('smoke.'))) {
      inventoryAttempted = true;
      providerInventoryVerified = false;
      try {
        const ids = [
          ...new Set(
            [...attemptedCaseIds]
              .flatMap((id) => native.caseReceipts(id).map((r) => r.executionId))
              .concat(native.snapshot().residualExecutionIds),
          ),
        ];
        const s = await admin.readGateway({
          query: foundationSettlementQuery,
          params: [activeWindowId, [], ids, '[]'],
        });
        if (s?.window_id !== activeWindowId || !Array.isArray(s.providers) || s.providers.length > 2) fail();
        const actual = s.providers
          .map((p) => {
            const id = p.launch?.apify_run_id;
            if (
              typeof id !== 'string' ||
              !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
              p.registry?.apify_run_id !== id
            )
              fail();
            return id;
          })
          .sort();
        const expected = [
          ...new Set([...attemptedCaseIds].flatMap((id) => native.caseSettlement(id)?.providerRunIds ?? [])),
        ].sort();
        providerInventoryVerified =
          native.snapshot().unresolvedCaseIds.length === 0 &&
          native.snapshot().unknownCandidateIds.length === 0 &&
          JSON.stringify(actual) === JSON.stringify(expected) &&
          s.providers.every(
            (p) =>
              ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(p.registry.status) &&
              p.registry.finished_at !== null &&
              p.registry.processed_at !== null &&
              p.run_finished_at !== null &&
              p.registry.processing_result !== null,
          );
        append({
          event: 'shutdown_provider_inventory',
          providerRunIds: actual,
          settled: providerInventoryVerified,
          at: new Date(now()).toISOString(),
        });
      } catch {
        /* Retain the unknown provider condition and continue independent shutdown. */
      }
    }
    await closeOwnedWindow();
    if (runtime && !baselineRestored) {
      try {
        const r = await runtime.restore();
        baselineRestored = r.status === 'exact_staging_restored_unpublished';
        if (baselineRestored)
          baselineRestored =
            assertFoundationRuntimeRestorationAudit(r, { plan: runtime.plan }).verifiedWorkflows === 25;
      } catch {
        baselineRestored = false;
      }
    }
    if (setup && !environmentCleanupVerified) {
      try {
        const r = await setup.cleanup();
        environmentCleanupVerified = r.state === 'setup_resources_removed';
      } catch {
        environmentCleanupVerified = false;
      }
    }
    if (reader && baselineIdsByKey && baselineRestored && !sweepAttempted) {
      sweepAttempted = true;
      finalOwnedSweepClean = true;
      for (const key of Object.keys(bindings.workflowRefs))
        try {
          const scan = await reader.discover({ workflowKey: key, baselineIds: baselineIdsByKey[key] });
          if (scan.paginationComplete !== true || scan.candidates.length) finalOwnedSweepClean = false;
        } catch {
          finalOwnedSweepClean = false;
        }
    }
    const snapshot = native?.snapshot();
    const remoteSettled =
      providerInventoryVerified &&
      finalOwnedSweepClean &&
      (!snapshot ||
        (!snapshot.residualExecutionIds.length &&
          !snapshot.unknownCandidateIds.length &&
          !snapshot.unresolvedCaseIds.length &&
          snapshot.pendingTransportCalls === 0 &&
          snapshot.cleanedExecutionIds.length === snapshot.observedExecutionIds));
    remoteWorkSettled = remoteSettled;
    if (canArchiveUnprovisionedFixture() && !archiveAttempted) {
      archiveAttempted = true;
      try {
        const r = await admin.archiveUnprovisioned();
        archived =
          exact(r, [
            'result',
            'company_code',
            'competitor_id',
            'account_id',
            'competitor_status',
            'account_status',
            'retained_items',
          ]) &&
          r.result === 'M03_SMOKE_FIXTURE_ARCHIVED' &&
          r.company_code === 'C999' &&
          r.competitor_id === fixture.competitor_id &&
          r.account_id === fixture.account_id &&
          r.competitor_status === 'archived' &&
          r.account_status === 'paused' &&
          Number.isSafeInteger(r.retained_items) &&
          r.retained_items >= 0;
      } catch {
        // The independent DB once-fence owns an ambiguous result; never replay.
        archived = false;
      }
    }
    if (fixture && windowClosed && remoteSettled && !archiveAttempted) {
      archiveAttempted = true;
      try {
        const r = await admin.archive();
        archived = r?.result === 'M03_SMOKE_FIXTURE_ARCHIVED';
      } catch {
        archived = false;
      }
    }
    return result(
      baselineRestored && environmentCleanupVerified ? 'restoration_verified' : 'restoration_residual',
      {
        baselineRestored,
        environmentCleanupVerified,
        windowClosed,
        fixtureArchived: archived,
        remoteWorkSettled: remoteSettled,
        residual:
          !baselineRestored || !environmentCleanupVerified || !remoteSettled || !windowClosed || !archived,
      },
    );
  }
  return Object.freeze({
    deadlineAt,
    acceptMcp: bridge.accept,
    stopNew() {
      failed = true;
      native?.closeAdmission();
      bridge.close();
    },
    async command(command) {
      if (
        closed ||
        busy ||
        !exact(
          command,
          Object.hasOwn(command ?? {}, 'caseId')
            ? ['kind', 'id', 'command', 'caseId']
            : ['kind', 'id', 'command'],
        ) ||
        command.kind !== 'm03_acceptance_command' ||
        typeof command.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(command.id)
      )
        fail();
      busy = true;
      try {
        if (now() >= deadlineAt - 600000 && !['state', 'restore'].includes(command.command)) fail();
        if (failed && !['state', 'restore'].includes(command.command)) fail();
        if (command.command === 'prepare') return await prepare();
        if (command.command === 'state') return result(prepared ? 'prepared' : 'not_prepared');
        if (command.command === 'run_case') return await runCase(command.caseId);
        if (command.command === 'run_domain') return await runDomain();
        if (!prepared && ['run_error', 'run_callback', 'run_callback_pair'].includes(command.command)) fail();
        if (command.command === 'run_error') {
          if (!/^automatic\.error\.[1-4]$/.test(command.caseId)) fail();
          attemptedCaseIds.add(command.caseId);
          const r = await native.runAutomaticErrorCase(Number(command.caseId.at(-1)));
          const verified = r.state === 'native_settled' && (await cleanupCase(r.caseId));
          if (!verified) failed = true;
          return result(verified ? 'native_settled_and_cleaned' : 'native_unresolved', {
            caseId: r.caseId,
            executionIds: r.executionIds,
            residual: !verified,
          });
        }
        if (command.command === 'run_callback' || command.command === 'run_callback_pair') {
          if (command.command === 'run_callback_pair' && Object.hasOwn(command, 'caseId')) fail();
          const caseId =
            command.command === 'run_callback_pair' ? 'callback.concurrent_pair' : command.caseId;
          const { status, ...outcome } = await verifyFoundationLiveCallbackSqlCase({
            caseId,
            readSnapshot: () => admin.replaySnapshot(),
            start: () => {
              attemptedCaseIds.add(caseId);
              return command.command === 'run_callback_pair'
                ? native.runConcurrentCallbackCases()
                : native.runCallbackCase(caseId);
            },
            cleanup: cleanupCase,
            append: ownerPreflight.append,
            now,
          });
          if (outcome.residual) failed = true;
          return result(status, outcome);
        }
        if (command.command === 'restore') return await restore();
        fail();
      } catch {
        failed = true;
        native?.closeAdmission();
        return result('blocked', { residual: true });
      } finally {
        busy = false;
      }
    },
    async close() {
      if (busy) fail();
      if (physicalClosed) return shutdownResult;
      let adminChildClosed = adminPhysicalClosed;
      let restored = setup === undefined && runtime === undefined;
      try {
        if (setup || runtime || canArchiveUnprovisionedFixture()) {
          const r = await restore();
          restored = r.residual === false;
        } else if (provisionAttempted && !windowClosed) await closeOwnedWindow();
      } catch {
        /* residual stays explicit */
      }
      bridge.close();
      nativeTransport?.close();
      provider?.close();
      gateway?.close();
      writerCloser?.close();
      baselinePreflight?.close();
      runtime?.close();
      try {
        setup?.close();
      } catch {
        /* retained private references stay in child until closure */
      }
      if (admin && !adminEndAttempted)
        try {
          adminEndAttempted = true;
          const r = await admin.end();
          adminChildClosed = r?.childClosed === true && r.receipt?.childrenClosed === true;
          acceptClosedAdminFixtureArchive(r, adminChildClosed);
          adminLifecycleVerified =
            adminChildClosed &&
            r.nativeExit === 0 &&
            r.receipt?.handoffDeleted === true &&
            r.receipt?.leaseDeleted === true &&
            r.receipt?.scratchDeleted === true;
        } catch {
          /* A missing final receipt does not prove credential-child closure. */
        }
      if (admin && !adminLifecycleVerified) {
        try {
          const r = await admin.abort();
          adminChildClosed = r?.childClosed === true && r.receipt?.childrenClosed === true;
          acceptClosedAdminFixtureArchive(r, adminChildClosed);
        } catch {
          /* No fake descendant closure. */
        }
      }
      adminPhysicalClosed = adminChildClosed;
      const transports = budget.close();
      closed = transports.closed && adminChildClosed;
      shutdownResult = result(closed ? 'closed' : 'residual', {
        childTransportsClosed: transports.closed,
        adminChildClosed,
        windowClosed,
        fixtureArchived: archived,
        baselineRestored,
        environmentCleanupVerified,
        remoteWorkSettled,
        residual: !closed || !restored || !adminLifecycleVerified || adminStartupFailure !== null,
      });
      physicalClosed = closed;
      return shutdownResult;
    },
  });
}

// A bounded persistent stdin protocol. Private first packet and tool results
// never pass through report(); only fixed technical summaries/port requests do.
export async function runFoundationLiveRuntimeCli({
  input = process.stdin,
  output = process.stdout,
  args = process.argv.slice(2),
  dependencies = {},
} = {}) {
  let privateValues = [];
  const emit = (value) => {
    const text = JSON.stringify(value);
    if (
      privateValues.some(
        (v) =>
          text.includes(v) ||
          text.includes(JSON.stringify(v).slice(1, -1)) ||
          text.includes(Buffer.from(v).toString('base64')),
      )
    )
      fail();
    output.write(text + '\n');
  };
  if (args.length === 1 && args[0] === 'CheckOnly') {
    const cliPath = join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/index.js');
    emit({
      kind: 'm03_acceptance_ready',
      status: 'check_only_execution_port_required',
      privateRead: false,
      networkCalls: 0,
      knownWorkflows: 25,
      managementMaximum: 512,
      controlMaximum: 2048,
      actualMcpPortVerified: false,
      concreteVercelCliPresent: existsSync(cliPath),
      concreteAdminHelperPresent: existsSync(
        join(repositoryRoot, 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1'),
      ),
    });
    return 0;
  }
  if (
    args.length !== 1 ||
    ![
      'Session',
      'SessionResumeZeroSetup',
      'SessionClockAmendment',
      'SessionPostcheckContinuation',
      'SessionRemainingContinuation',
      'SessionStartupReplacement',
      'SessionProjectVerifiedContinuation',
    ].includes(args[0])
  )
    return 1;
  let zeroSetupProof;
  let clockAmendmentProof;
  let postcheckContinuationProof;
  let remainingContinuationProof;
  let startupReplacementProof;
  let projectVerifiedContinuationProof;
  if (args[0] === 'SessionResumeZeroSetup') {
    try {
      zeroSetupProof = assertFoundationLiveZeroSetupProof(
        (dependencies.verifyZeroSetup ?? verifyFoundationLiveZeroSetup)({
          now: dependencies.now ?? Date.now,
        }),
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  if (args[0] === 'SessionClockAmendment') {
    try {
      const proof = (dependencies.readClockAmendment ?? readFoundationClockAmendment)({
        now: dependencies.now ?? Date.now,
      });
      clockAmendmentProof = assertFoundationLiveClockAmendmentProof(
        (dependencies.claimClockAmendment ?? claimFoundationClockAmendment)(proof, {
          now: dependencies.now ?? Date.now,
        }),
        { claimed: true },
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  if (args[0] === 'SessionPostcheckContinuation') {
    try {
      const proof = (dependencies.readPostcheckContinuation ?? readFoundationPostcheckContinuation)({
        now: dependencies.now ?? Date.now,
      });
      postcheckContinuationProof = assertFoundationLivePostcheckContinuationProof(
        (dependencies.claimPostcheckContinuation ?? claimFoundationPostcheckContinuation)(proof, {
          now: dependencies.now ?? Date.now,
        }),
        { claimed: true },
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  if (args[0] === 'SessionRemainingContinuation') {
    try {
      const proof = (dependencies.readRemainingContinuation ?? readFoundationRemainingContinuation)({
        now: dependencies.now ?? Date.now,
      });
      remainingContinuationProof = assertFoundationLiveRemainingContinuationProof(
        (dependencies.claimRemainingContinuation ?? claimFoundationRemainingContinuation)(proof, {
          now: dependencies.now ?? Date.now,
        }),
        { claimed: true },
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  if (args[0] === 'SessionStartupReplacement') {
    try {
      const proof = (dependencies.readStartupReplacement ?? readFoundationStartupReplacement)({
        now: dependencies.now ?? Date.now,
      });
      startupReplacementProof = assertFoundationLiveStartupReplacementProof(
        (dependencies.claimStartupReplacement ?? claimFoundationStartupReplacement)(proof, {
          now: dependencies.now ?? Date.now,
        }),
        { claimed: true },
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  if (args[0] === 'SessionProjectVerifiedContinuation') {
    try {
      const proof = (
        dependencies.readProjectVerifiedContinuation ?? readFoundationProjectVerifiedContinuation
      )({ now: dependencies.now ?? Date.now });
      projectVerifiedContinuationProof = assertFoundationLiveProjectVerifiedContinuationProof(
        (dependencies.claimProjectVerifiedContinuation ?? claimFoundationProjectVerifiedContinuation)(proof, {
          now: dependencies.now ?? Date.now,
        }),
        { claimed: true },
      );
    } catch {
      emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
      return 1;
    }
  }
  let session,
    running = false,
    finished = false,
    bytes = 0,
    lineBytes = 0,
    protocolFailed = false,
    outcomeFailed = false,
    stopTimer;
  let lines;
  const guard = (chunk) => {
    const b = Buffer.from(chunk);
    bytes += b.length;
    for (const byte of b) {
      lineBytes = byte === 10 ? 0 : lineBytes + 1;
      if (lineBytes > 1048576 || bytes > 4194304) {
        protocolFailed = true;
        input.destroy();
        lines?.close();
        return;
      }
    }
  };
  const releaseInput = () => {
    lines?.close();
    input.removeListener('data', guard);
    input.pause();
    clearTimeout(stopTimer);
  };
  input.on('data', guard);
  lines = createInterface({ input, crlfDelay: Infinity });
  const jobs = new Set();
  let closing;
  for await (const line of lines) {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      protocolFailed = true;
      break;
    }
    if (!session) {
      try {
        session = createFoundationLiveAcceptanceSession(value, emit, {
          ...dependencies,
          ...(zeroSetupProof ? { zeroSetupProof } : {}),
          ...(clockAmendmentProof ? { clockAmendmentProof } : {}),
          ...(postcheckContinuationProof ? { postcheckContinuationProof } : {}),
          ...(remainingContinuationProof ? { remainingContinuationProof } : {}),
          ...(startupReplacementProof ? { startupReplacementProof } : {}),
          ...(projectVerifiedContinuationProof ? { projectVerifiedContinuationProof } : {}),
        });
        privateValues = [
          'managementKey',
          'writerPassword',
          'apifyReadToken',
          'machineToken',
          'protectionBypass',
        ].map((k) => value[k]);
        emit({
          kind: 'm03_acceptance_ready',
          status: 'private_child_ready',
          deadlineAt: session.deadlineAt,
          approvedHead,
          sourceCommitSha: value.sourceCommitSha,
        });
        // New work stops at minute50. Remaining fixed restoration work still
        // uses the original minute60 action deadline; no extra action window.
        stopTimer = (dependencies.setStopTimer ?? setTimeout)(
          () => {
            session.stopNew();
            finished = true;
            lines.close();
          },
          Math.max(0, session.deadlineAt - (dependencies.now ?? Date.now)() - 600000),
        );
        stopTimer?.unref?.();
      } catch {
        emit({ kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
        releaseInput();
        return 1;
      }
      continue;
    }
    if (value?.kind === 'mcp_port_result') {
      if (!session.acceptMcp(value)) {
        protocolFailed = true;
        break;
      }
      continue;
    }
    const allowed = [
      'prepare',
      'state',
      'run_case',
      'run_domain',
      'run_error',
      'run_callback',
      'run_callback_pair',
      'restore',
      'close',
    ];
    if (
      running ||
      !exact(
        value,
        Object.hasOwn(value ?? {}, 'caseId')
          ? ['kind', 'id', 'command', 'caseId']
          : ['kind', 'id', 'command'],
      ) ||
      value.kind !== 'm03_acceptance_command' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(value.id) ||
      !allowed.includes(value.command)
    ) {
      protocolFailed = true;
      break;
    }
    if (value.command === 'close') {
      closing = session.close().then((r) => {
        outcomeFailed ||= r.residual !== false;
        emit({ kind: 'm03_acceptance_closed', ...r });
      });
      await closing;
      finished = true;
      break;
    }
    running = true;
    const job = session
      .command(value)
      .then(
        (r) => {
          running = false;
          outcomeFailed ||= r.status === 'blocked' || r.residual === true;
          emit({ kind: 'm03_acceptance_result', id: value.id, command: value.command, ...r });
        },
        () => {
          running = false;
          emit({
            kind: 'm03_acceptance_result',
            id: value?.id ?? 'invalid',
            command: value?.command ?? 'invalid',
            status: 'blocked',
            residual: true,
          });
        },
      )
      .finally(() => {
        jobs.delete(job);
      });
    jobs.add(job);
  }
  await Promise.allSettled(jobs);
  if (session && !closing) {
    try {
      const r = await session.close();
      outcomeFailed ||= r.residual !== false;
      emit({ kind: 'm03_acceptance_closed', ...r });
    } catch {
      outcomeFailed = true;
      emit({ kind: 'm03_acceptance_closed', status: 'residual', residual: true });
    }
  }
  releaseInput();
  return finished && !protocolFailed && !outcomeFailed ? 0 : 1;
}

// The finite functional path composes the same transports and transition code.
// Native UI/SQL observations are operator evidence, never fabricated brands for
// the historical supervisor. It exposes named tasks, not an arbitrary API proxy.
export function foundationFunctionalCommand(value) {
  const commands = {
    state: [],
    prepare_preview: [],
    prepare_runtime: [],
    authorize_start: [],
    callback_unknown: [],
    restore: [],
    close: [],
    close_window: [],
    charge_control: ['count'],
    charge_management: ['count'],
    provider: ['apifyRunId'],
    callback_valid: ['apifyRunId'],
    original: ['apifyRunId', 'runId'],
    save_replay: ['apifyRunId', 'runId'],
  };
  const keys = Object.hasOwn(commands, value?.command) ? commands[value.command] : undefined;
  return (
    keys !== undefined &&
    exact(value, ['id', 'command', ...keys]) &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.id) &&
    (!keys.includes('count') ||
      (Number.isSafeInteger(value.count) && value.count > 0 && value.count <= 100)) &&
    (!keys.includes('apifyRunId') || /^[A-Za-z0-9_-]{5,64}$/.test(value.apifyRunId)) &&
    (!keys.includes('runId') ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.runId))
  );
}

// A successful return means every byte reached the synchronous writer. The
// caller fsyncs only afterwards, before any remote operation is authorized.
export function writeFoundationFunctionalBytes(fd, bytes, write = writeSync) {
  if (!Buffer.isBuffer(bytes) || typeof write !== 'function') throw Error('M03_FUNCTIONAL_DURABLE_WRITE');
  let offset = 0;
  while (offset < bytes.length) {
    const written = write(fd, bytes, offset, bytes.length - offset, null);
    if (!Number.isSafeInteger(written) || written < 1 || written > bytes.length - offset)
      throw Error('M03_FUNCTIONAL_DURABLE_WRITE');
    offset += written;
  }
}

// Independent owned resources get independent cleanup after SQL/native work is
// actually safe. A failed/unknown Close prevents removal of the callback path.
export async function restoreFoundationFunctionalResources({ closeWindow, restoreRuntime, cleanupPreview }) {
  if ([closeWindow, restoreRuntime, cleanupPreview].some((operation) => typeof operation !== 'function'))
    throw Error('M03_FUNCTIONAL_CLEANUP_PORT');
  await closeWindow();
  let runtimeRestored = false,
    previewCleaned = false;
  try {
    await restoreRuntime();
    runtimeRestored = true;
  } catch {
    /* Preserve the runtime residual. */
  }
  try {
    await cleanupPreview();
    previewCleaned = true;
  } catch {
    /* Preserve the Preview residual. */
  }
  return Object.freeze({ runtimeRestored, previewCleaned });
}

export async function runFoundationFunctionalCli({
  input: inputStream = process.stdin,
  emit = (row) => process.stdout.write(JSON.stringify(row) + '\n'),
  checkOnly = process.argv[2] === 'FunctionalCheckOnly',
  stateDirectory = join(repositoryRoot, 'scripts/n8n/out/foundation/live'),
} = {}) {
  const { mkdirSync, lstatSync, unlinkSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { foundationFunctionalBaselineVersions: versions } = await import('./foundation-runtime-plan.mjs');
  const output = (row) => emit({ kind: 'm03_functional_result', ...row });
  const blocked = (code) => {
    throw Error('M03_FUNCTIONAL_' + code);
  };
  const parseJson = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return blocked('INPUT');
    }
  };
  const number = (value, minimum, maximum) =>
    Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  const stamp = (value) =>
    typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  const caps = { management: 2176, control: 3584, combined: 5312, vercel: 400 };
  const checkpoint = { management: 1661, control: 1464, combined: 3125, vercel: 288 };
  const historyAggregate = 'ded9037b363fe2cbf6d7dc2e19731c1fe25963100db92b160967c84ec7b7c6d9';
  if (checkOnly) {
    versions();
    output({ id: 'public', status: 'check_only_ready', code: 'M03_FUNCTIONAL_PUBLIC_READY' });
    return 0;
  }
  let lineBytes = 0,
    totalBytes = 0,
    protocolFailed = false;
  const lines = createInterface({ input: inputStream, crlfDelay: Infinity });
  const guard = (chunk) => {
    for (const byte of Buffer.from(chunk)) {
      totalBytes++;
      lineBytes = byte === 10 ? 0 : lineBytes + 1;
      if (lineBytes > 32768 || totalBytes > 131072) {
        protocolFailed = true;
        lines.close();
        inputStream.pause();
        return;
      }
    }
  };
  inputStream.on('data', guard);
  const iterator = lines[Symbol.asyncIterator]();
  let privateInput,
    scope,
    append,
    ended = false;
  const transports = new Set();
  const ownedScratch = new Map();
  try {
    const first = await iterator.next();
    if (protocolFailed || first.done || Buffer.byteLength(first.value) > 32768) blocked('INPUT');
    privateInput = parseJson(first.value);
    if (
      !exact(privateInput, [
        'kind',
        'version',
        'sourceCommitSha',
        'managementKey',
        'writerPassword',
        'apifyReadToken',
        'machineToken',
        'protectionBypass',
      ]) ||
      privateInput.kind !== 'm03_functional_private_input' ||
      privateInput.version !== 1 ||
      !/^[a-f0-9]{40}$/.test(privateInput.sourceCommitSha) ||
      ['managementKey', 'apifyReadToken'].some(
        (k) => typeof privateInput[k] !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(privateInput[k]),
      ) ||
      typeof privateInput.writerPassword !== 'string' ||
      !privateInput.writerPassword ||
      privateInput.writerPassword.length > 4096 ||
      !/^[A-Za-z0-9_-]{43}$/.test(privateInput.machineToken) ||
      !/^[A-Za-z0-9]{32}$/.test(privateInput.protectionBypass)
    )
      blocked('INPUT');
    const base = resolve(stateDirectory);
    mkdirSync(base, { recursive: true });
    const journalPath = join(base, 'functional-acceptance-20261025.jsonl');
    const readJson = (name, maximum = 524288) => {
      const path = join(base, name),
        stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > maximum)
        blocked('LOCAL_EVIDENCE');
      const bytes = readFileSync(path);
      if (bytes.length > maximum) blocked('LOCAL_EVIDENCE');
      return parseJson(bytes.toString('utf8'));
    };
    const journalStat = lstatSync(journalPath);
    if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.size > 4194304)
      blocked('HISTORY');
    const rows = readFileSync(journalPath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((row) => parseJson(row));
    const delivery = rows.find(
      (row) => row.kind === 'delivery_verified' && row.head === '890892eb7c61293f0f449102d095acc6fb212765',
    );
    if (
      !delivery ||
      !exact(delivery.usageUnchanged, [...Object.keys(checkpoint), 'actors', 'usd']) ||
      Object.keys(checkpoint).some((key) => delivery.usageUnchanged[key] !== checkpoint[key]) ||
      delivery.usageUnchanged.actors !== 0 ||
      delivery.usageUnchanged.usd !== 0
    )
      blocked('HISTORY');
    let usage = { ...checkpoint };
    const usageValid = (value) =>
      exact(value, Object.keys(checkpoint)) &&
      Object.keys(checkpoint).every((k) => number(value[k], checkpoint[k], caps[k])) &&
      value.combined === value.management + value.control &&
      value.vercel <= value.management;
    let latestVercelOrdinal = checkpoint.vercel;
    for (const row of rows) {
      if (row.kind === 'functional_usage') {
        if (!usageValid(row.usage) || Object.keys(checkpoint).some((k) => row.usage[k] < usage[k]))
          blocked('HISTORY');
        usage = { ...row.usage };
      }
      if (row.kind === 'functional_setup' && row.row?.event === 'setup_attempt') {
        if (!number(row.row.ordinal, latestVercelOrdinal + 1, latestVercelOrdinal + 1)) blocked('HISTORY');
        latestVercelOrdinal = row.row.ordinal;
      }
    }
    if (usage.vercel !== latestVercelOrdinal) blocked('HISTORY_RECONCILE');
    const opened = rows.filter((row) => row.kind === 'functional_open').at(-1);
    if (opened && !rows.some((row) => row.kind === 'functional_closed' && row.windowId === opened.windowId))
      blocked('RECONCILE');
    // A prior actor intent is never permission to start a replacement actor.
    if (rows.some((row) => row.kind === 'functional_actor_intent')) blocked('ACTOR_RECONCILE');
    append = (row) => {
      const fd = openSync(journalPath, 'a');
      try {
        writeFoundationFunctionalBytes(
          fd,
          Buffer.from(JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n'),
        );
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    };
    scope = {
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      windowId: randomUUID(),
      sourceCommitSha: privateInput.sourceCommitSha,
      caps,
      carried: { ...usage },
      restoredBaselineVersions: versions(),
    };
    append({ kind: 'functional_open', windowId: scope.windowId, sourceCommitSha: scope.sourceCommitSha });
    const startsAt = Date.now(),
      stopNewAt = startsAt + 3000000,
      deadlineAt = startsAt + 3600000;
    const persistUsage = () => append({ kind: 'functional_usage', usage });
    const debit = (kind, count = 1) => {
      if (!['management', 'control'].includes(kind) || !number(count, 1, 100)) blocked('LIMIT');
      const next = { ...usage, [kind]: usage[kind] + count };
      next.combined = next.management + next.control;
      if (!usageValid(next)) blocked('LIMIT');
      append({ kind: 'functional_usage', usage: next });
      usage = next;
    };
    const budget = {
      admit: () => debit('management'),
      snapshot: () => ({ attempts: usage.management, maximum: caps.management }),
      attachTransport: (t) => transports.add(t),
    };
    const report = (id, status, extra = {}) =>
      output({
        id,
        status,
        ...usage,
        windowId: scope.windowId,
        sourceCommitSha: scope.sourceCommitSha,
        ...extra,
      });
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    const transport = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
    );
    const records = Object.keys(bindings.workflowRefs).map((key) =>
      JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
    );
    let setup, deployment, plan, ports, gateway, fixtureReceipt, firstEvidence, replayDraft;
    let runtimeReady = false,
      runtimeRestored = false,
      resourcesRestored = false,
      windowClosed = false,
      provisionObserved = false;
    let actorIntent = false,
      providerVerified = false,
      replaySaved = false;
    let providerAttempts = rows.filter((row) => row.kind === 'functional_provider_get').length;
    let gatewayAttempts = rows.filter((row) => row.kind === 'functional_gateway_probe').length;
    const callbacks = new Set();
    const operator = (stage) => {
      const r = readJson('functional-dev-verified.json', 32768),
        observed = Date.parse(r.observedAt);
      if (
        r.method !== 'native_sql_editor' ||
        r.projectRef !== scope.projectRef ||
        r.stage !== stage ||
        !stamp(r.observedAt) ||
        Date.now() - observed > 300000 ||
        observed > Date.now() + 30000 ||
        r.identityVerified !== true ||
        r.migrationCount !== 15 ||
        r.historyAggregate !== historyAggregate ||
        r.quiescent !== true ||
        r.fixtureOwned !== true ||
        !number(r.globalAdmittedCount, 0, 256)
      )
        blocked('DB_EVIDENCE');
      if (['preflight', 'provisioned'].includes(stage) && r.globalAdmittedCount + 71 > 256)
        blocked('SQL_RESERVE');
      if (
        stage !== 'preflight' &&
        (!deployment ||
          r.windowId !== scope.windowId ||
          r.sourceCommitSha !== scope.sourceCommitSha ||
          r.audience !== deployment.audience ||
          r.deploymentId !== deployment.deploymentId)
      )
        blocked('DB_BINDING');
      if (stage === 'provisioned') {
        provisionObserved = true;
        if (r.protectionWithoutBypassDenied !== true || ![401, 403].includes(r.protectionWithoutBypassStatus))
          blocked('PROTECTED_PREVIEW');
        const f = r.fixtureReceipt;
        if (
          !exact(f, [
            'result',
            'company_code',
            'competitor_id',
            'account_id',
            'platform',
            'url',
            'competitor_status',
            'account_status',
          ]) ||
          f.result !== 'M03_SMOKE_FIXTURE_READY' ||
          f.company_code !== 'C999' ||
          f.competitor_id !== 'd51a39f6-fe87-4d17-aee9-3070c45693aa' ||
          f.account_id !== 'bd23314c-591f-4fb7-92fd-b7450634eeb6' ||
          f.platform !== 'website_work_page' ||
          f.url !== 'https://everyone.film/about-everyone' ||
          f.competitor_status !== 'active' ||
          f.account_status !== 'active'
        )
          blocked('FIXTURE');
        fixtureReceipt = structuredClone(f);
      }
      if (
        stage === 'settled' &&
        (r.nativeWorkSettled !== true ||
          !Array.isArray(r.unfinishedNativeExecutionIds) ||
          r.unfinishedNativeExecutionIds.length)
      )
        blocked('SETTLEMENT');
      return r;
    };
    const localEvidence = (name) => {
      const r = readJson(name),
        observed = Date.parse(r.observedAt);
      if (
        r.method !== 'native_sql_editor' ||
        r.projectRef !== scope.projectRef ||
        !stamp(r.observedAt) ||
        Date.now() - observed > 300000 ||
        observed > Date.now() + 30000 ||
        r.windowId !== scope.windowId ||
        r.sourceCommitSha !== scope.sourceCommitSha ||
        !deployment ||
        r.audience !== deployment.audience ||
        r.deploymentId !== deployment.deploymentId
      )
        blocked('ORIGINAL_EVIDENCE');
      return r;
    };
    const writeScratch = (name, value) => {
      const path = join(base, name),
        bytes = Buffer.from(JSON.stringify(value)),
        fd = openSync(path, 'wx', 0o600);
      try {
        writeFoundationFunctionalBytes(fd, bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      ownedScratch.set(path, sha(bytes));
      return sha(bytes);
    };
    async function closeWindow() {
      if (windowClosed) return;
      if (!deployment) {
        windowClosed = true;
        return;
      }
      // Once a Preview exists, an external owner provision may have happened.
      // Absence of a JS plan is never evidence that the SQL window is absent.
      const r = operator('settled');
      if (r.windowAbsent === true) {
        if (provisionObserved || plan || actorIntent || r.launchAbsent !== true || r.actorRunId !== null)
          blocked('SETTLEMENT');
        append({
          kind: 'functional_window_absent',
          windowId: scope.windowId,
          method: 'native_sql_editor',
          observedAt: r.observedAt,
        });
        windowClosed = true;
        return;
      }
      if (!actorIntent && !(r.actorRunId === null && r.launchAbsent === true)) blocked('SETTLEMENT');
      if (
        actorIntent &&
        (firstEvidence
          ? r.actorRunId !== firstEvidence.registered.apify_run_id
          : !(typeof r.actorRunId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(r.actorRunId)) &&
            !(r.actorRunId === null && r.launchAbsent === true))
      )
        blocked('SETTLEMENT');
      const closer = createFoundationLiveWriterCloser({
        password: privateInput.writerPassword,
        audience: deployment.audience,
        sourceCommitSha: scope.sourceCommitSha,
        deploymentId: deployment.deploymentId,
        windowId: scope.windowId,
        functionalScope: scope,
        deadlineAt,
        previousEvents: [],
        append: (row) => append({ kind: 'functional_writer', windowId: scope.windowId, row }),
      });
      transports.add(closer);
      const result = await closer.closeWindow();
      if (!result.closeVerified || !result.connectionClosed) blocked('WINDOW_CLOSE');
      windowClosed = true;
    }
    async function restore() {
      if (resourcesRestored) return;
      const restored = await restoreFoundationFunctionalResources({
        closeWindow: async () => {
          if (deployment || provisionObserved) await closeWindow();
        },
        restoreRuntime: async () => {
          if (ports && !runtimeRestored) {
            const r = await restoreFoundationRuntime(plan, ports);
            if (r.status !== 'exact_staging_restored_unpublished') blocked('RESTORE');
            runtimeRestored = true;
          }
        },
        cleanupPreview: async () => {
          if (setup) {
            const r = await setup.cleanup();
            if (r.state !== 'setup_resources_removed') blocked('PREVIEW_CLEANUP');
          }
        },
      });
      append({
        kind: 'functional_resource_restoration',
        windowId: scope.windowId,
        windowClosed,
        runtimeRestored: restored.runtimeRestored,
        previewCleaned: restored.previewCleaned,
      });
      if (!restored.runtimeRestored || !restored.previewCleaned) blocked('RESTORE_RESIDUAL');
      resourcesRestored = true;
    }
    const sourceReplay = (cmd) => {
      if (
        !firstEvidence ||
        cmd.apifyRunId !== firstEvidence.registered.apify_run_id ||
        (cmd.runId !== undefined && cmd.runId !== firstEvidence.registered.run_id)
      )
        blocked('ORIGINAL_IDENTITY');
    };
    async function callback(cmd, unknown) {
      if (!runtimeReady || Date.now() >= stopNewAt || callbacks.has(cmd.command)) blocked('CALLBACK_ORDER');
      if (unknown) {
        const r = operator('unknown_before');
        if (r.unknownRegistryAbsent !== true || r.unknownLaunchAbsent !== true) blocked('UNKNOWN_REGISTRY');
      } else {
        sourceReplay(cmd);
        if (!providerVerified) blocked('PROVIDER_REQUIRED');
      }
      const apifyRunId = unknown ? 'M03AcceptanceUnknown0001' : cmd.apifyRunId;
      // Only the already-public provider callback shape goes to this fixed URL.
      // There is no management header, token, generic host, redirect or retry.
      callbacks.add(cmd.command);
      debit('control');
      append({
        kind: 'functional_callback_intent',
        windowId: scope.windowId,
        command: cmd.command,
        apifyRunId,
      });
      const response = await fetch('https://muhhammedsayed.app.n8n.cloud/webhook/emr-apify-callback', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(Math.min(20000, deadlineAt - Date.now())),
        headers: { 'content-type': 'application/json', connection: 'close' },
        body: JSON.stringify({ eventType: 'ACTOR.RUN.SUCCEEDED', resource: { id: apifyRunId } }),
      });
      let size = 0;
      const chunks = [];
      if (!response.body) blocked('CALLBACK_RESPONSE');
      try {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 1024) blocked('CALLBACK_RESPONSE');
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        if (!response.body.locked) await response.body.cancel().catch(() => {});
      }
      const body = parseJson(Buffer.concat(chunks).toString('utf8'));
      if (
        response.status !== (unknown ? 403 : 200) ||
        (unknown
          ? body.ok !== false || body.rejected !== true
          : body.ok !== true ||
            body.processed !== true ||
            body.replayed !== true ||
            body.apify_run_id !== apifyRunId)
      )
        blocked('CALLBACK_RESPONSE');
      append({
        kind: 'functional_callback_ack',
        windowId: scope.windowId,
        command: cmd.command,
        apifyRunId,
        httpStatus: response.status,
      });
      report(cmd.id, 'callback_sent', {
        apifyRunId,
        code: unknown ? 'M03_FUNCTIONAL_UNKNOWN_CALLBACK_ACK' : 'M03_FUNCTIONAL_REPLAY_CALLBACK_ACK',
      });
    }
    report('start', 'ready');
    for (;;) {
      const next = await iterator.next();
      if (protocolFailed) blocked('INPUT');
      let cmd;
      try {
        cmd = next.done ? { id: 'stdin_closed', command: 'close' } : parseJson(next.value);
        if (!foundationFunctionalCommand(cmd)) blocked('COMMAND');
        const cleanupCommand = [
          'restore',
          'close',
          'close_window',
          'state',
          'charge_control',
          'charge_management',
        ].includes(cmd.command);
        if (!cleanupCommand && Date.now() >= stopNewAt) blocked('STOP_NEW');
        const id = cmd.id;
        if (cmd.command === 'charge_control' || cmd.command === 'charge_management') {
          debit(cmd.command === 'charge_control' ? 'control' : 'management', cmd.count);
          report(id, 'ready');
        } else if (cmd.command === 'state')
          report(
            id,
            'ready',
            deployment ? { audience: deployment.audience, deploymentId: deployment.deploymentId } : {},
          );
        else if (cmd.command === 'prepare_preview') {
          if (setup) blocked('DUPLICATE');
          operator('preflight');
          const journal = createFoundationLiveSetupJournal({
            sourceCommitSha: scope.sourceCommitSha,
            maximumRequests: caps.vercel,
            functionalScope: scope,
            previousEvents: [],
            durableAppend: (row) => {
              append({ kind: 'functional_setup', windowId: scope.windowId, row });
              if (row.event === 'setup_attempt') {
                if (row.ordinal !== usage.vercel + 1 || row.ordinal > caps.vercel) blocked('VERCEL_HISTORY');
                usage = { ...usage, vercel: row.ordinal };
                persistUsage();
              }
            },
          });
          const cli = createFoundationLiveSetupCliTransport({
            nodeExecutable: process.execPath,
            cliPath: join(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js'),
            noRetryPreloadPath: join(repositoryRoot, 'scripts/n8n/foundation-live-setup-no-retry.mjs'),
            workingDirectory: repositoryRoot,
            now: Date.now,
            deadlineAt,
            authorizeRequest: (spec) => setup?.authorizeRequest(spec) === true,
          });
          transports.add(cli);
          setup = createFoundationLiveSetup({
            sourceCommitSha: scope.sourceCommitSha,
            activeWindowId: scope.windowId,
            functionalScope: scope,
            transport: cli,
            journal,
            managementBudget: budget,
            now: Date.now,
            deadlineAt,
            pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
            verifyDevReady: async () => ({
              projectRef: operator('preflight').projectRef,
              migrationCount: 15,
              ready: true,
            }),
            sensitive: {
              writerPassword: privateInput.writerPassword,
              machineToken: privateInput.machineToken,
              apifyReadToken: privateInput.apifyReadToken,
              protectionBypass: privateInput.protectionBypass,
            },
          });
          deployment = await setup.prepare();
          append({ kind: 'functional_preview', windowId: scope.windowId, deployment });
          report(id, 'prepared', { audience: deployment.audience, deploymentId: deployment.deploymentId });
        } else if (cmd.command === 'prepare_runtime') {
          if (!deployment || plan) blocked('ORDER');
          operator('provisioned');
          gateway = createFoundationLiveGatewayProbe({
            audience: deployment.audience,
            machineToken: privateInput.machineToken,
            protectionBypass: privateInput.protectionBypass,
            deadlineAt,
            admitGatewayAttempt: ({ requestId, unauthorized }) => {
              if (++gatewayAttempts > 16) blocked('GATEWAY_LIMIT');
              append({ kind: 'functional_gateway_probe', windowId: scope.windowId, requestId, unauthorized });
            },
          });
          transports.add(gateway);
          const a = await gateway.identity(),
            denied = await gateway.identity({ unauthorized: true });
          if (
            a.status !== 200 ||
            a.body?.result?.currentUser !== 'n8n_writer' ||
            a.body.result.sessionUser !== 'n8n_writer' ||
            a.body.result.projectRef !== scope.projectRef ||
            a.body.window?.id !== scope.windowId ||
            a.body.window.closed !== false ||
            a.body.window.boundCommitSha !== scope.sourceCommitSha ||
            a.body.window.boundAudience !== deployment.audience ||
            a.body.window.boundDeploymentId !== deployment.deploymentId ||
            ![401, 403].includes(denied.status)
          )
            blocked('IDENTITY');
          append({
            kind: 'functional_identity_verified',
            windowId: scope.windowId,
            restrictedRole: 'n8n_writer',
            deniedStatus: denied.status,
          });
          const { createFoundationRuntimeSetupOutput } = await import('./foundation-runtime-plan.mjs');
          plan = createFoundationRuntimePlan({
            bindings,
            records,
            transport,
            functionalScope: scope,
            activeWindowId: scope.windowId,
            setup: createFoundationRuntimeSetupOutput({
              ...deployment,
              protectionTransportVerified: true,
              sqlAudienceBindingVerified: true,
            }),
          });
          const journal = createFoundationRuntimeJournal(plan, [], (row) =>
            append({ kind: 'functional_runtime', windowId: scope.windowId, row }),
          );
          const management = createFoundationLiveManagementTransport({
            plan,
            apiKey: privateInput.managementKey,
            sensitiveValues: [privateInput.machineToken, privateInput.protectionBypass],
            deadlineAt,
          });
          transports.add(management);
          ports = {
            journal,
            send: management.send,
            admitManagementAttempt: budget.admit,
            prepareMachinePatch: ({ audience, restore: revert }) =>
              prepareFoundationRuntimeMachinePatch({
                audience,
                restore: revert,
                machineToken: privateInput.machineToken,
                ...(revert ? {} : { protectionBypass: privateInput.protectionBypass }),
              }),
          };
          const r = await runFoundationRuntimeSetup(plan, ports);
          if (r.status !== 'runtime_setup_verified') blocked('RUNTIME');
          const draft = materializeFoundationRuntimeCase(plan, 'smoke.first', {
            fixtureReceipt,
            release: { launchEnabled: true },
          });
          const receipt = await saveFoundationRuntimeCase(plan, draft, ports);
          if (receipt.status !== 'case_draft_verified') blocked('CASE');
          runtimeReady = true;
          report(id, 'runtime_ready', { workflowId: receipt.workflowId, versionId: receipt.versionId });
        } else if (cmd.command === 'authorize_start') {
          const ready = operator('ready');
          if (
            !runtimeReady ||
            actorIntent ||
            Date.now() >= stopNewAt ||
            usage.management + 91 > caps.management ||
            usage.control + 126 > caps.control ||
            usage.combined + 217 > caps.combined ||
            usage.vercel + 18 > caps.vercel ||
            ready.globalAdmittedCount + 71 > 256
          )
            blocked('START');
          actorIntent = true;
          append({
            kind: 'functional_actor_intent',
            windowId: scope.windowId,
            workflowId: bindings.workflowRefs['WF-99'].id,
          });
          report(id, 'case_ready', { workflowId: bindings.workflowRefs['WF-99'].id });
        } else if (cmd.command === 'original') {
          if (!runtimeReady || !actorIntent || firstEvidence) blocked('ORIGINAL_ORDER');
          const envelope = localEvidence('functional-original-context.json'),
            original = envelope.original;
          if (
            !original ||
            original.launch?.window_id !== scope.windowId ||
            original.launch.apify_run_id !== cmd.apifyRunId ||
            original.launch.run_id !== cmd.runId
          )
            blocked('ORIGINAL_IDENTITY');
          const d = original.datasetRead;
          if (
            !d ||
            !Array.isArray(d.rows) ||
            d.rows.length !== 1 ||
            d.transport?.requests !== 2 ||
            d.transport.retries !== 0 ||
            d.transport.socketsClosed !== true ||
            d.transport.runBytesMax !== 65536 ||
            d.transport.datasetBytesMax !== 262144
          )
            blocked('ORIGINAL_DATASET');
          const shared = require('../../n8n/normalizers/smoke_website_stub.js');
          const { createM03SmokeWebsiteNormalizer } = require('../../n8n/normalizers/smoke_website_m03.js');
          const normalize = createM03SmokeWebsiteNormalizer(
            shared.validateSmokeWebsiteRow,
            shared.buildSmokeWebsiteSnapshot,
            shared.invalidWebsiteRow,
          );
          const t = createApifyRecoveryRuntime().validateTerminal(d.terminal),
            registered = original.registered;
          const atomicInput = {
            p_apify_run_id: registered.apify_run_id,
            p_status: t.status,
            p_dataset_id: t.datasetId,
            p_usage_usd: t.usageTotalUsd,
            p_groups: [
              {
                account_id: registered.account_ids[0],
                normalizer_version: 'smoke_website_stub.v1',
                items: [normalize(d.rows[0]).json],
              },
            ],
          };
          firstEvidence = {
            source: 'bounded-original-dataset-read',
            readRequestId: original.readRequestId,
            launch: original.launch,
            registered,
            atomicInput,
            costEntry: original.costEntry,
          };
          // The existing materializer checks exact launch/account/registry/cost identity and original receipt.
          replayDraft = materializeFoundationRuntimeCase(plan, 'sub.ingest.replay_a', {
            fixtureReceipt,
            firstRunEvidence: firstEvidence,
          });
          createApifyRecoveryRuntime().validateReceipt(registered.processing_result, registered, atomicInput);
          const bodySha256 = writeScratch('functional-atomic-input.json', atomicInput);
          append({
            kind: 'functional_original_verified',
            windowId: scope.windowId,
            apifyRunId: cmd.apifyRunId,
            runId: cmd.runId,
            bodySha256,
          });
          report(id, 'content_ready', { apifyRunId: cmd.apifyRunId, runId: cmd.runId, bodySha256 });
        } else if (cmd.command === 'provider') {
          sourceReplay(cmd);
          if (providerVerified || !actorIntent) blocked('PROVIDER_ORDER');
          const provider = createFoundationLiveProviderReader({
            token: privateInput.apifyReadToken,
            deadlineAt,
            admitProviderAttempt: () => {
              if (providerAttempts + 10 >= 32) blocked('PROVIDER_LIMIT');
              append({
                kind: 'functional_provider_get',
                windowId: scope.windowId,
                ordinal: ++providerAttempts,
                apifyRunId: cmd.apifyRunId,
              });
            },
          });
          transports.add(provider);
          const a = (await provider.read({ apifyRunId: cmd.apifyRunId })).body;
          const firstAt = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 10000));
          const b = (await provider.read({ apifyRunId: cmd.apifyRunId })).body;
          for (const value of [a, b]) {
            const d = value?.data;
            if (
              !d ||
              d.id !== cmd.apifyRunId ||
              d.actId !== 'aYG0l9s7dbB7j3gbS' ||
              d.buildId !== 'BdKJRCYsnmlzPfH3n' ||
              d.buildNumber !== '0.3.99' ||
              !stamp(d.startedAt) ||
              Date.parse(d.startedAt) < startsAt - 5000 ||
              Date.parse(d.startedAt) > Date.now() + 30000 ||
              d.options?.memoryMbytes !== 1024 ||
              d.options.timeoutSecs !== 300 ||
              d.options.maxTotalChargeUsd !== 1
            )
              blocked('PROVIDER_IDENTITY');
          }
          const recovery = createApifyRecoveryRuntime(),
            r = firstEvidence.registered;
          const t = recovery.settle(
            recovery.projectTerminal(a, r),
            recovery.projectTerminal(b, r),
            Date.now() - firstAt,
          );
          if (
            t.status !== 'SUCCEEDED' ||
            t.usageTotalUsd > 1 ||
            Date.parse(t.finishedAt) > Date.now() + 30000 ||
            t.datasetId !== r.dataset_id
          )
            blocked('PROVIDER_PARITY');
          recovery.validateReceipt(r.processing_result, r, {
            ...firstEvidence.atomicInput,
            p_usage_usd: t.usageTotalUsd,
          });
          providerVerified = true;
          append({
            kind: 'functional_provider_terminal',
            windowId: scope.windowId,
            apifyRunId: t.apifyRunId,
            status: t.status,
            usageUsd: t.usageTotalUsd,
          });
          report(id, 'provider_terminal', {
            apifyRunId: t.apifyRunId,
            providerStatus: t.status,
            costUsd: t.usageTotalUsd,
          });
        } else if (cmd.command === 'save_replay') {
          sourceReplay(cmd);
          if (!providerVerified || !replayDraft || replaySaved) blocked('REPLAY_ORDER');
          const checked = operator('atomic_input');
          if (
            checked.atomicInputMatched !== true ||
            checked.atomicInputSha256 !== ownedScratch.get(join(base, 'functional-atomic-input.json'))
          )
            blocked('ATOMIC_INPUT');
          replaySaved = true;
          const r = await saveFoundationRuntimeCase(plan, replayDraft, ports);
          if (r.status !== 'case_draft_verified') blocked('REPLAY_SAVE');
          report(id, 'case_ready', {
            workflowId: r.workflowId,
            versionId: r.versionId,
            apifyRunId: cmd.apifyRunId,
            runId: cmd.runId,
          });
        } else if (cmd.command === 'callback_valid') await callback(cmd, false);
        else if (cmd.command === 'callback_unknown') await callback(cmd, true);
        else if (cmd.command === 'close_window') {
          await closeWindow();
          report(id, 'ready', { code: 'M03_FUNCTIONAL_WINDOW_CLOSED' });
        } else if (cmd.command === 'restore') {
          await restore();
          report(id, 'restored', { code: 'M03_FUNCTIONAL_RESOURCES_RESTORED' });
        } else if (cmd.command === 'close') {
          await restore();
          if (((deployment || provisionObserved) && !windowClosed) || !resourcesRestored)
            blocked('WINDOW_OPEN');
          for (const t of transports) await t.close();
          if ([...transports].some((t) => t.state().pendingRequests || t.state().unclosedResponses))
            blocked('TRANSPORT_OPEN');
          append({ kind: 'functional_closed', windowId: scope.windowId });
          ended = true;
          report(id, 'closed', { code: 'M03_FUNCTIONAL_CLOSED' });
          break;
        }
      } catch (error) {
        const code = /^M03_FUNCTIONAL_[A-Z_]{1,64}$/.test(error?.message)
          ? error.message
          : 'M03_FUNCTIONAL_BLOCKED';
        append({
          kind: 'functional_command_failure',
          windowId: scope.windowId,
          command: foundationFunctionalCommand(cmd) ? cmd.command : 'invalid',
          code,
        });
        report(foundationFunctionalCommand(cmd) ? cmd.id : 'failure', 'blocked', { code });
        // Keep the owned process and callback path available for native state
        // reconciliation and cleanup. EOF cannot produce an endless retry loop.
        if (next.done) break;
      }
    }
    return ended ? 0 : 1;
  } catch (error) {
    const code = /^M03_FUNCTIONAL_[A-Z_]{1,64}$/.test(error?.message)
      ? error.message
      : 'M03_FUNCTIONAL_BLOCKED';
    if (append && scope) append({ kind: 'functional_failure', windowId: scope.windowId, code });
    output({ id: 'failure', status: 'blocked', code });
    return 1;
  } finally {
    lines.close();
    inputStream.removeListener('data', guard);
    inputStream.pause();
    for (const t of transports) await t.close();
    if (privateInput)
      for (const key of [
        'managementKey',
        'writerPassword',
        'apifyReadToken',
        'machineToken',
        'protectionBypass',
      ])
        privateInput[key] = null;
    for (const [path, expected] of ownedScratch) {
      try {
        const stat = lstatSync(path);
        if (stat.isFile() && !stat.isSymbolicLink() && sha(readFileSync(path)) === expected) unlinkSync(path);
      } catch {
        /* Preserve unknown scratch rather than deleting an unverified file. */
      }
    }
    if (append && scope && !ended)
      append({ kind: 'functional_interrupted', windowId: scope.windowId, reconciliationRequired: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (process.argv[2]?.startsWith('Functional')
    ? runFoundationFunctionalCli()
    : runFoundationLiveRuntimeCli()
  ).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.stdout.write('{"kind":"m03_acceptance_closed","status":"blocked","residual":true}\n');
      process.exitCode = 1;
    },
  );
}
