import { readFileSync, existsSync } from 'node:fs';
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
} from './foundation-live-runtime-transport.mjs';
import {
  createFoundationLiveSetup,
  createFoundationLiveSetupJournal,
  assertFoundationLiveDeployment,
} from './foundation-live-setup.mjs';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { startFoundationAdminClient } from '../db/foundation-admin-client.mjs';
import { createFoundationNativeTransport } from './foundation-native-transport.mjs';
import { createFoundationNativeReader, assertFoundationNativeReceipt } from './foundation-native-reader.mjs';
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
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const selected = new Map(
  foundationAcceptancePlan()
    .cases.filter((c) => c.recommendedLive)
    .map((c) => [c.id, c]),
);

// Fixed post-settlement SQL assertion: no actor, new input, price, SQL string or
// provider ID can be supplied independently of the genuine native/SQL proof.
export async function verifyFoundationLiveSmokeSql({
  caseId,
  receipts,
  settlement,
  admin,
  append,
  now = Date.now,
}) {
  const proof = assertFoundationSettlementReceipt(settlement);
  if (
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
  const s = await admin.readGateway({ query: foundationSettlementQuery, params: [windowId, [], ids, '[]'] });
  const p = s?.providers?.[0],
    expected = caseId === 'smoke.first' ? 1 : 0,
    original = proof.providerRunIds;
  if (
    s?.window_id !== windowId ||
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
  if ([resume, amendment, previousContinuation, remaining].filter(Boolean).length > 1) fail();
  const continuation = remaining || previousContinuation;
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
  const budget = createFoundationLiveManagementBudget(
    { sourceCommitSha: input.sourceCommitSha, deadlineAt },
    {
      ...(dependencies.storage ?? {}),
      now,
      ...(resume ? { zeroSetupProof: resume } : {}),
      ...(amendment ? { clockAmendmentProof: amendment } : {}),
      ...(previousContinuation ? { postcheckContinuationProof: previousContinuation } : {}),
      ...(remaining ? { remainingContinuationProof: remaining } : {}),
    },
  );
  if ((resume || admittedClock) && budget.snapshot().attempts !== (remaining ? 4 : 0)) {
    budget.close();
    fail();
  }
  const ownerPreflight = foundationLiveAuxiliaryStorage(budget, 'preflight');
  if (ownerPreflight.previousEvents.length) {
    budget.close();
    fail();
  }
  const nativeStorage = foundationLiveAuxiliaryStorage(budget, 'control');
  if ((resume || amendment) && nativeStorage.previousEvents.length) {
    budget.close();
    fail();
  }
  if (
    continuation &&
    (nativeStorage.previousEvents.length !== (remaining ? 100 : 50) ||
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
  const controlBudget = createFoundationControlBudget({
    journal: controlJournal,
    now,
    deadlineAt,
    ...(remaining ? { remainingContinuationProof: remaining } : {}),
  });
  if (continuation && controlBudget.snapshot().attempts !== (remaining ? 101 : 50)) {
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
  const bridge = createFoundationLiveMcpBridge({ bindings, emit, deadlineAt, now });
  let runtime,
    setup,
    admin,
    native,
    reader,
    cleanup,
    provider,
    gateway,
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
  let gatewayAttempts = 0,
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
    nativeExecutions: native?.snapshot().nativeExecutions ?? 0,
    gatewayPreflightAttempts: gatewayAttempts,
    providerDirectAttempts: providerAttempts,
    phaseBReady: native?.snapshot().phaseBReady ?? false,
    domainProofReady: domainProof !== null,
    businessAcceptanceProven: false,
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
    composeReader();
    baselineIdsByKey = {};
    for (const key of Object.keys(bindings.workflowRefs)) {
      const scan = await reader.discover({ workflowKey: key, baselineIds: [] });
      if (scan.paginationComplete !== true) fail();
      baselineIdsByKey[key] = scan.candidates.map((v) => v.executionId);
    }
    adminPhysicalClosed = false;
    adminLifecycleVerified = false;
    admin = await (dependencies.startAdmin ?? startFoundationAdminClient)({
      repositoryRoot,
      now,
      ...(resume ? { originalDeadlineAtMs: resume.deadlineAt } : {}),
      ...(amendment ? { clockAmendmentProof: amendment } : {}),
      ...(previousContinuation ? { postcheckContinuationProof: previousContinuation } : {}),
      ...(remaining ? { remainingContinuationProof: remaining } : {}),
    });
    const ready = await admin.postcheck();
    if (ready?.ready !== true || ready.projectRef !== 'zmotjsbzhzjvpelxvxlf' || ready.migrationCount !== 14)
      fail();
    fixture = await admin.fixture();
    preflight = await admin.preflight();
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
    const storage = foundationLiveAuxiliaryStorage(budget, 'setup');
    const setupJournal = createFoundationLiveSetupJournal({
      sourceCommitSha: input.sourceCommitSha,
      previousEvents: storage.previousEvents,
      durableAppend: storage.append,
    });
    let t;
    t = (dependencies.createSetupTransport ?? createFoundationLiveSetupCliTransport)({
      nodeExecutable: process.execPath,
      cliPath: join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/index.js'),
      noRetryPreloadPath: join(repositoryRoot, 'scripts/n8n/foundation-live-setup-no-retry.mjs'),
      workingDirectory: repositoryRoot,
      now,
      deadlineAt,
      authorizeRequest: (spec) => setup?.authorizeRequest(spec) === true,
    });
    setup = createFoundationLiveSetup(
      {
        sourceCommitSha: input.sourceCommitSha,
        transport: t,
        journal: setupJournal,
        managementBudget: budget,
        ...(remaining ? { remainingContinuationProof: remaining } : {}),
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
    deployment = assertFoundationLiveDeployment(await setup.prepare());
    provisionAttempted = true;
    const provision = await admin.provision({
      audience: deployment.audience,
      commitSha: input.sourceCommitSha,
      deploymentId: deployment.deploymentId,
    });
    if (
      provision?.windowId !== windowId ||
      provision.boundAudience !== deployment.audience ||
      provision.boundCommitSha !== input.sourceCommitSha ||
      provision.boundDeploymentId !== deployment.deploymentId ||
      provision.started !== false ||
      provision.closed !== false ||
      provision.totalAdmitted !== 0 ||
      provision.approvalCount !== 1
    )
      fail();
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
      w?.id !== windowId ||
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
        setup: { ...deployment, protectionTransportVerified: true, sqlAudienceBindingVerified: true },
        managementKey: input.managementKey,
        machineToken: input.machineToken,
        protectionBypass: input.protectionBypass,
        deadlineAt,
      },
      { managementBudget: budget, controlJournal, controlBudget, now, ...(dependencies.runtime ?? {}) },
    );
    if ((await runtime.setup()).status !== 'runtime_setup_verified') fail();
    const ports = composeNative();
    native = createFoundationExecutionController({
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
    const before = spec.requiresFirstRunEvidence ? await admin.replaySnapshot() : null;
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
        if (JSON.stringify(await admin.replaySnapshot()) !== JSON.stringify(before)) fail();
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
          params: [windowId, [], ids, '[]'],
        });
        if (s?.window_id !== windowId || !Array.isArray(s.providers) || s.providers.length > 2) fail();
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
    if (provisionAttempted && !closeAttempted) {
      closeAttempted = true;
      try {
        const r = await admin.close();
        windowClosed = r?.state === 'closed';
      } catch {
        /* Unknown Close is never replayed. */
      }
    }
    if (runtime && !baselineRestored) {
      try {
        const r = await runtime.restore();
        baselineRestored = r.status === 'exact_staging_restored_unpublished';
        if (baselineRestored) baselineRestored = (await runtime.finalAudit()).verifiedWorkflows === 25;
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
          attemptedCaseIds.add(
            command.command === 'run_callback_pair' ? 'callback.concurrent_pair' : command.caseId,
          );
          const r =
            command.command === 'run_callback_pair'
              ? await native.runConcurrentCallbackCases()
              : await native.runCallbackCase(command.caseId);
          const verified = r.state === 'native_settled' && (await cleanupCase(r.caseId));
          if (!verified) failed = true;
          return result(verified ? 'native_settled_and_cleaned' : 'native_unresolved', {
            caseId: r.caseId,
            executionIds: r.executionIds,
            residual: !verified,
          });
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
        } else if (provisionAttempted && !windowClosed) {
          await admin.close();
          windowClosed = true;
        }
      } catch {
        /* residual stays explicit */
      }
      bridge.close();
      nativeTransport?.close();
      provider?.close();
      gateway?.close();
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
        residual: !closed || !restored || !adminLifecycleVerified,
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
    ].includes(args[0])
  )
    return 1;
  let zeroSetupProof;
  let clockAmendmentProof;
  let postcheckContinuationProof;
  let remainingContinuationProof;
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFoundationLiveRuntimeCli().then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.stdout.write('{"kind":"m03_acceptance_closed","status":"blocked","residual":true}\n');
      process.exitCode = 1;
    },
  );
}
