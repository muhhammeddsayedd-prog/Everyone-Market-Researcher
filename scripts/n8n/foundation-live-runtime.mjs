import {
  openSync,
  closeSync,
  writeSync,
  fsyncSync,
  readFileSync,
  existsSync,
  mkdirSync,
  lstatSync,
  fstatSync,
  unlinkSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFoundationRuntimePlan,
  materializeFoundationRuntimeCase,
  materializeFoundationRuntimeDomainProbe,
} from './foundation-runtime-plan.mjs';
import {
  createFoundationRuntimeJournal,
  foundationRuntimeState,
  runFoundationRuntimeSetup,
  saveFoundationRuntimeCase,
  restoreFoundationRuntime,
  reconcileFoundationRuntimeReadOnly,
  createFoundationRuntimeBinding,
  runtimeGraphHash,
  foundationRuntimeGuardDiagnostic,
} from './foundation-runtime-control.mjs';
import { foundationRuntimeObservedGraphHash } from './foundation-runtime-checkpoint.mjs';
import {
  createFoundationControlJournal,
  createFoundationControlBudget,
  assertFoundationControlJournal,
  assertFoundationControlBudget,
} from './foundation-control-state.mjs';
import { prepareFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';
import {
  createFoundationLiveManagementTransport,
  assertFoundationLiveBaselineReceipt,
} from './foundation-live-runtime-transport.mjs';
import { assertFoundationLiveZeroSetupProof } from './foundation-live-zero-setup.mjs';
import {
  assertFoundationLiveClockAmendmentProof,
  foundationClockAmendmentCheckpoint,
} from './foundation-live-clock-amendment.mjs';
import {
  assertFoundationLivePostcheckContinuationProof,
  foundationPostcheckContinuationCheckpoint,
} from './foundation-live-postcheck-continuation.mjs';
import {
  assertFoundationLiveRemainingContinuationProof,
  foundationRemainingContinuationCheckpoint,
  assertFoundationRemainingJournalPrefixes,
} from './foundation-live-remaining-continuation.mjs';
import {
  assertFoundationLiveStartupReplacementProof,
  foundationStartupReplacementCheckpoint,
  assertFoundationStartupReplacementJournalPrefixes,
} from './foundation-live-startup-replacement.mjs';
import {
  assertFoundationLiveProjectVerifiedContinuationProof,
  foundationProjectVerifiedContinuationCheckpoint,
  assertFoundationProjectVerifiedContinuationJournalPrefixes,
  foundationProjectVerifiedContinuationResumeCheckpoint,
} from './foundation-live-project-verified-continuation.mjs';

const fail = () => {
  throw Error('FOUNDATION_LIVE_RUNTIME_BLOCKED');
};
const repo = fileURLToPath(new URL('../../', import.meta.url));
const managementBudgets = new WeakMap();
const clockBudgetOwners = new WeakSet();
function noLinks(path) {
  let p = resolve(path);
  for (;;) {
    try {
      if (lstatSync(p).isSymbolicLink()) fail();
    } catch (error) {
      if (error?.code !== 'ENOENT') fail();
    }
    const parent = dirname(p);
    if (parent === p) break;
    p = parent;
  }
}
function readRows(path, maxRows) {
  noLinks(path);
  if (!existsSync(path)) return [];
  const st = lstatSync(path);
  if (!st.isFile() || st.size > 2097152) fail();
  const text = readFileSync(path, 'utf8');
  if (text && !text.endsWith('\n')) fail();
  const rows = text ? text.slice(0, -1).split('\n') : [];
  if (rows.length > maxRows) fail();
  try {
    return rows.map((line) => JSON.parse(line));
  } catch {
    fail();
  }
}
function appendFile(path, row) {
  noLinks(path);
  const bytes = Buffer.from(JSON.stringify(row) + '\n');
  if (bytes.length > 131072) fail();
  let fd;
  try {
    fd = openSync(path, 'a');
    for (let at = 0; at < bytes.length;) {
      const wrote = writeSync(fd, bytes, at, bytes.length - at);
      if (!Number.isSafeInteger(wrote) || wrote <= 0) fail();
      at += wrote;
    }
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// This pool exists before the new deployment/plan is known. Vercel delivery,
// runtime setup/case/restoration all debit the SAME cumulative ledger and child lock.
// Its deadline is supplied by the concrete admitted child, never module import.
export function createFoundationLiveManagementBudget({ sourceCommitSha, deadlineAt }, dependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const resume =
    dependencies.zeroSetupProof === undefined
      ? null
      : assertFoundationLiveZeroSetupProof(dependencies.zeroSetupProof);
  const amendment =
    dependencies.clockAmendmentProof === undefined
      ? null
      : assertFoundationLiveClockAmendmentProof(dependencies.clockAmendmentProof, { claimed: true });
  const continuation =
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
  if ([resume, amendment, continuation, remaining, startup, verified].filter(Boolean).length > 1) fail();
  const verifiedCheckpoint = verified
    ? foundationProjectVerifiedContinuationResumeCheckpoint(verified)
    : null;
  const managementMaximum = verifiedCheckpoint?.managementMaximum ?? 512;
  if (![512, 576, 640, 704, 832].includes(managementMaximum)) fail();
  const sharedMaximum = managementMaximum !== 512;
  let observedControlAttempts = verifiedCheckpoint?.aggregateControlAttempts;
  const readControlAttempts = () => {
    let value;
    try {
      value = dependencies.controlAttempts();
    } catch {
      fail();
    }
    if (!Number.isSafeInteger(value) || value < observedControlAttempts || value > 2048) fail();
    observedControlAttempts = value;
    return value;
  };
  if (sharedMaximum) {
    if (
      typeof dependencies.controlAttempts !== 'function' ||
      !Number.isSafeInteger(observedControlAttempts) ||
      observedControlAttempts < 0 ||
      observedControlAttempts > 2048
    )
      fail();
    readControlAttempts();
  }
  const admittedClock = verified || startup || remaining || continuation || amendment;
  if (
    !/^[a-f0-9]{40}$/.test(sourceCommitSha) ||
    typeof now !== 'function' ||
    !Number.isFinite(deadlineAt) ||
    deadlineAt <= now() ||
    deadlineAt > now() + 3600000
  )
    fail();
  if (
    admittedClock &&
    (admittedClock.sourceCommitSha !== sourceCommitSha ||
      admittedClock.deadlineAt !== deadlineAt ||
      now() < admittedClock.startsAt ||
      now() >= admittedClock.stopNewAt ||
      clockBudgetOwners.has(admittedClock))
  )
    fail();
  if (admittedClock) clockBudgetOwners.add(admittedClock);
  const reuse = resume || admittedClock;
  const headerDeadlineAt = verified
    ? foundationProjectVerifiedContinuationCheckpoint.originalDeadlineAt
    : startup
      ? foundationStartupReplacementCheckpoint.originalDeadlineAt
      : remaining
        ? foundationRemainingContinuationCheckpoint.originalDeadlineAt
        : continuation
          ? foundationPostcheckContinuationCheckpoint.originalDeadlineAt
          : amendment
            ? foundationClockAmendmentCheckpoint.originalDeadlineAt
            : deadlineAt;
  if (
    resume &&
    (resume.sourceCommitSha !== sourceCommitSha ||
      resume.deadlineAt !== deadlineAt ||
      now() >= resume.stopNewAt)
  )
    fail();
  const directory = resolve(dependencies.directory ?? join(repo, 'scripts/n8n/out/foundation/live'));
  noLinks(directory);
  if (reuse) {
    if (!lstatSync(directory).isDirectory()) fail();
  } else mkdirSync(directory, { recursive: true });
  noLinks(directory);
  const lockPath = join(directory, 'runtime.operation.lock');
  let lock;
  try {
    lock = openSync(lockPath, 'wx');
  } catch {
    fail();
  }
  const releaseLock = () => {
    if (lock === undefined) return;
    noLinks(lockPath);
    const st = lstatSync(lockPath),
      own = fstatSync(lock);
    if (!st.isFile() || st.dev !== own.dev || st.ino !== own.ino) fail();
    closeSync(lock);
    lock = undefined;
    unlinkSync(lockPath);
  };
  let stopped = false,
    closed = false,
    attempts = 0;
  const transports = new Set();
  try {
    const marker = Buffer.from('emr-m03-foundation-live-runtime-v1\n');
    for (let at = 0; at < marker.length;) {
      const wrote = writeSync(lock, marker, at, marker.length - at);
      if (!Number.isSafeInteger(wrote) || wrote <= 0) fail();
      at += wrote;
    }
    fsyncSync(lock);
    const path = join(directory, 'management.jsonl');
    if (reuse && !lstatSync(path).isFile()) fail();
    if (!reuse && !existsSync(path))
      appendFile(path, { event: 'management_header', version: 1, sourceCommitSha, deadlineAt });
    const rows = readRows(path, managementMaximum + 1),
      header = rows.shift();
    if (verified)
      assertFoundationProjectVerifiedContinuationJournalPrefixes(verified, {
        managementText: readFileSync(path, 'utf8'),
      });
    if (startup)
      assertFoundationStartupReplacementJournalPrefixes(startup, {
        managementText: readFileSync(path, 'utf8'),
      });
    if (remaining)
      assertFoundationRemainingJournalPrefixes(remaining, { managementText: readFileSync(path, 'utf8') });
    if (
      !header ||
      Object.keys(header).length !== 4 ||
      header.event !== 'management_header' ||
      header.version !== 1 ||
      header.sourceCommitSha !==
        (verified ? (verifiedCheckpoint.headerSourceCommitSha ?? sourceCommitSha) : sourceCommitSha) ||
      header.deadlineAt !== headerDeadlineAt ||
      (reuse &&
        rows.length !==
          (verified ? verifiedCheckpoint.mainManagementAttempts : startup || remaining ? 1 : 0)) ||
      rows.some(
        (r, i) => Object.keys(r).length !== 2 || r.event !== 'management_attempt' || r.ordinal !== i + 1,
      )
    )
      fail();
    const carriedAttempts = (verified || startup || remaining)?.carriedManagementAttempts ?? 0;
    attempts = rows.length;
    const budget = Object.freeze({
      admit() {
        if (closed || stopped || attempts + carriedAttempts >= managementMaximum || now() >= deadlineAt)
          fail();
        if (sharedMaximum) {
          let controlAttempts;
          try {
            controlAttempts = readControlAttempts();
          } catch {
            stopped = true;
            fail();
          }
          if (attempts + carriedAttempts + controlAttempts >= 2560) fail();
        }
        try {
          const ordinal = attempts + 1;
          // The expanded paired pool must charge an uncertain append before
          // Control can observe this counter, even if fsync/close then fails.
          if (sharedMaximum) attempts = ordinal;
          appendFile(path, { event: 'management_attempt', ordinal });
          if (!sharedMaximum) attempts = ordinal;
        } catch {
          stopped = true;
          fail();
        }
      },
      snapshot: () =>
        Object.freeze({
          attempts: attempts + carriedAttempts,
          mainAttempts: attempts,
          carriedAttempts,
          maximum: managementMaximum,
          deadlineAt,
          stopped,
          closed,
        }),
      attachTransport(transport) {
        if (
          closed ||
          !transport ||
          typeof transport.state !== 'function' ||
          typeof transport.close !== 'function'
        )
          fail();
        transports.add(transport);
      },
      close() {
        if (closed) return Object.freeze({ closed: true, unresolvedTransport: false });
        for (const t of transports) t.close();
        for (const t of transports) {
          const s = t.state();
          if (!s || s.pendingRequests !== 0 || s.unclosedResponses !== 0)
            return Object.freeze({ closed: false, unresolvedTransport: true });
        }
        closed = true;
        releaseLock();
        return Object.freeze({ closed: true, unresolvedTransport: false });
      },
    });
    managementBudgets.set(budget, {
      directory,
      sourceCommitSha,
      deadlineAt,
      ...(verified ? { runtimeFilename: verifiedCheckpoint.runtimeFilename } : {}),
    });
    return budget;
  } catch {
    releaseLock();
    fail();
  }
}
export function assertFoundationLiveManagementBudget(budget, expected = {}) {
  if (!managementBudgets.has(budget) || !Object.isFrozen(budget) || budget.snapshot().closed) fail();
  const scope = managementBudgets.get(budget);
  if (
    !expected ||
    typeof expected !== 'object' ||
    Object.keys(expected).some((k) => !['sourceCommitSha', 'deadlineAt'].includes(k)) ||
    (expected.sourceCommitSha !== undefined && expected.sourceCommitSha !== scope.sourceCommitSha) ||
    (expected.deadlineAt !== undefined && expected.deadlineAt !== scope.deadlineAt)
  )
    fail();
  return budget;
}
export function foundationLiveAuxiliaryStorage(budget, kind) {
  assertFoundationLiveManagementBudget(budget);
  if (!['setup', 'preflight', 'control'].includes(kind)) fail();
  const path = join(managementBudgets.get(budget).directory, kind + '.jsonl');
  return Object.freeze({
    previousEvents: readRows(path, kind === 'control' ? 8000 : 500),
    append(row) {
      assertFoundationLiveManagementBudget(budget);
      appendFile(path, row);
    },
  });
}

// Concrete Phase-A runtime composition. No read of private files, hosted call,
// clock start, MCP action or actor action occurs merely by importing this file.
export function createFoundationLiveRuntime(input, dependencies = {}) {
  const plan = createFoundationRuntimePlan(input);
  const now = dependencies.now ?? Date.now;
  if (
    !Number.isFinite(input.deadlineAt) ||
    input.deadlineAt <= now() ||
    input.deadlineAt > now() + 3600000 ||
    typeof input.managementKey !== 'string' ||
    !/^[\x21-\x7e]{1,4096}$/.test(input.managementKey) ||
    typeof input.machineToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.machineToken) ||
    typeof input.protectionBypass !== 'string' ||
    !/^[A-Za-z0-9_-]{16,1024}$/.test(input.protectionBypass)
  )
    fail();
  const ownsBudget = dependencies.managementBudget === undefined;
  const budget =
    dependencies.managementBudget ??
    createFoundationLiveManagementBudget(
      {
        sourceCommitSha: input.setup.sourceCommitSha,
        deadlineAt: input.deadlineAt,
      },
      { now, ...(dependencies.directory === undefined ? {} : { directory: dependencies.directory }) },
    );
  assertFoundationLiveManagementBudget(budget);
  const scope = managementBudgets.get(budget);
  const managementMaximum = budget.snapshot().maximum;
  if (scope.sourceCommitSha !== input.setup.sourceCommitSha || scope.deadlineAt !== input.deadlineAt) fail();
  const baselinePreflightReceipt = dependencies.baselinePreflightReceipt;
  if (baselinePreflightReceipt !== undefined)
    assertFoundationLiveBaselineReceipt(baselinePreflightReceipt, {
      baseline: plan.baseline,
      deadlineAt: input.deadlineAt,
      managementBudget: budget,
    });
  const directory = scope.directory;
  let transport,
    closed = false,
    busy = false,
    failed = false;
  try {
    const runtimePath = join(directory, scope.runtimeFilename ?? 'runtime.jsonl'),
      controlPath = join(directory, 'control.jsonl');
    for (const path of [runtimePath, ...(dependencies.controlJournal === undefined ? [controlPath] : [])])
      if (!existsSync(path))
        appendFile(path, {
          event: 'file_header',
          version: 1,
          planHash: plan.planHash,
          deadlineAt: input.deadlineAt,
        });
    const load = (path, limit) => {
      const rows = readRows(path, limit + 1),
        header = rows.shift();
      if (
        !header ||
        Object.keys(header).length !== 4 ||
        header.event !== 'file_header' ||
        header.version !== 1 ||
        header.planHash !== plan.planHash ||
        header.deadlineAt !== input.deadlineAt
      )
        fail();
      return rows;
    };
    const journal = createFoundationRuntimeJournal(plan, load(runtimePath, 1800), (row) =>
      appendFile(runtimePath, row),
    );
    const controlJournal =
      dependencies.controlJournal ??
      createFoundationControlJournal({
        previousEvents: load(controlPath, 8000),
        durableAppend: (row) => appendFile(controlPath, row),
      });
    assertFoundationControlJournal(controlJournal);
    const controlBudget =
      dependencies.controlBudget ??
      createFoundationControlBudget({ journal: controlJournal, now, deadlineAt: input.deadlineAt });
    assertFoundationControlBudget(controlBudget, { journal: controlJournal, deadlineAt: input.deadlineAt });
    transport = dependencies.send
      ? { send: dependencies.send, state: dependencies.transportState, close: dependencies.closeTransport }
      : createFoundationLiveManagementTransport(
          {
            plan,
            apiKey: input.managementKey,
            sensitiveValues: [input.machineToken, input.protectionBypass],
            deadlineAt: input.deadlineAt,
          },
          { now, ...(dependencies.https ?? {}) },
        );
    if (typeof transport.state !== 'function' || typeof transport.close !== 'function') fail();
    budget.attachTransport(transport);
    let machineToken = input.machineToken,
      protectionBypass = input.protectionBypass;
    const ports = {
      journal,
      ...(baselinePreflightReceipt === undefined
        ? {}
        : {
            baselinePreflightReceipt,
            deadlineAt: input.deadlineAt,
            managementBudget: budget,
          }),
      send: (method, path, body) => transport.send(method, path, body),
      admitManagementAttempt() {
        if (closed || failed || now() >= input.deadlineAt) fail();
        try {
          budget.admit();
        } catch {
          failed = true;
          fail();
        }
      },
      prepareMachinePatch({ audience, restore }) {
        if (closed || !machineToken) fail();
        return prepareFoundationRuntimeMachinePatch({
          audience,
          restore,
          machineToken,
          ...(restore ? {} : { protectionBypass }),
        });
      },
    };
    const exclusive = async (fn) => {
      if (closed || failed || busy || now() >= input.deadlineAt) fail();
      busy = true;
      try {
        return await fn();
      } catch {
        fail();
      } finally {
        busy = false;
      }
    };
    return Object.freeze({
      plan,
      controlJournal,
      controlBudget,
      managementBudget: budget,
      checkOnly: () =>
        Object.freeze({
          status: 'local_runtime_ready',
          privateFileRead: false,
          hostedActions: 0,
          setupDriftGuardGetCount: baselinePreflightReceipt === undefined ? 25 : 0,
          managementMaximum,
          controlMaximum: 2048,
        }),
      setup: () =>
        exclusive(() => {
          const state = foundationRuntimeState(plan, journal);
          const setupRequests = baselinePreflightReceipt === undefined ? 135 : 110;
          if (
            state.requestCount === 0 &&
            budget.snapshot().attempts + setupRequests + 142 > managementMaximum
          )
            return Object.freeze({ status: 'shared_management_reserve_required' });
          return runFoundationRuntimeSetup(plan, ports);
        }),
      diagnostics: () => foundationRuntimeGuardDiagnostic(journal),
      saveCase: (caseId, options = {}) =>
        exclusive(() => {
          if (budget.snapshot().attempts + 3 + 142 > managementMaximum)
            return Object.freeze({ status: 'shared_management_reserve_required' });
          return saveFoundationRuntimeCase(
            plan,
            materializeFoundationRuntimeCase(plan, caseId, options),
            ports,
          );
        }),
      saveDomainProbe: () =>
        exclusive(() => {
          if (budget.snapshot().attempts + 3 + 142 > managementMaximum)
            return Object.freeze({ status: 'shared_management_reserve_required' });
          return saveFoundationRuntimeCase(plan, materializeFoundationRuntimeDomainProbe(plan), ports);
        }),
      verifyMachine: () =>
        exclusive(async () => {
          const state = foundationRuntimeState(plan, journal);
          if (!state.setupComplete || state.restoreComplete || state.pending) fail();
          ports.admitManagementAttempt();
          const audit = foundationLiveAuxiliaryStorage(budget, 'preflight');
          audit.append({
            event: 'machine_metadata_guard_intent',
            credentialId: plan.machine.id,
            expectedUpdatedAt: state.machineUpdatedAt,
            ordinal: budget.snapshot().attempts,
            at: new Date(now()).toISOString(),
          });
          const r = await transport.send('GET', '/api/v1/credentials/' + plan.machine.id, null),
            d = r?.body;
          if (
            r?.status !== 200 ||
            !d ||
            Object.hasOwn(d, 'data') ||
            d.id !== plan.machine.id ||
            d.name !== plan.machine.name ||
            d.type !== plan.machine.type ||
            d.createdAt !== plan.machine.createdAt ||
            d.updatedAt !== state.machineUpdatedAt ||
            ['isManaged', 'isGlobal', 'isResolvable'].some((k) => d[k] !== undefined && d[k] !== false) ||
            (d.resolverId !== undefined && d.resolverId !== null)
          )
            fail();
          audit.append({
            event: 'machine_metadata_guard_verified',
            credentialId: plan.machine.id,
            updatedAt: d.updatedAt,
            ordinal: budget.snapshot().attempts,
            at: new Date(now()).toISOString(),
          });
          return Object.freeze({
            status: 'owned_machine_metadata_unchanged',
            savedDomainEnforcementProven: false,
          });
        }),
      bindingFor(key, options = {}) {
        if (closed || busy) fail();
        return createFoundationRuntimeBinding(plan, key, ports, options);
      },
      restore: () => exclusive(() => restoreFoundationRuntime(plan, ports)),
      reconcile: () => exclusive(() => reconcileFoundationRuntimeReadOnly(plan, ports)),
      finalAudit: () =>
        exclusive(async () => {
          const state = foundationRuntimeState(plan, journal);
          if (!state.restoreComplete || state.pending) fail();
          let verified = 0;
          for (const b of plan.baseline) {
            ports.admitManagementAttempt();
            const r = await transport.send(
              'GET',
              '/api/v1/workflows/' + b.id + '?excludePinnedData=true',
              null,
            );
            const dto = r?.body;
            const tags = (v) =>
              JSON.stringify(
                [...v].map((t) => ({ id: t.id, name: t.name })).sort((a, z) => a.id.localeCompare(z.id)),
              );
            if (
              r?.status !== 200 ||
              !dto ||
              dto.id !== b.id ||
              dto.versionId !== state.workflows[b.key].versionId ||
              dto.active !== false ||
              dto.activeVersionId !== null ||
              dto.isArchived !== false ||
              !Array.isArray(dto.shared) ||
              !dto.shared.some((s) => s.projectId === plan.projectId && s.role === 'workflow:owner') ||
              !Array.isArray(dto.tags) ||
              tags(dto.tags) !== tags(b.tags) ||
              (dto.pinData != null &&
                (typeof dto.pinData !== 'object' ||
                  Array.isArray(dto.pinData) ||
                  Object.keys(dto.pinData).length)) ||
              foundationRuntimeObservedGraphHash(dto, b) !== runtimeGraphHash(b.body)
            )
              fail();
            verified++;
          }
          return Object.freeze({
            status: 'exact_staging_final_audit_verified',
            verifiedWorkflows: verified,
            schedulesPublished: 0,
            actorStarts: 0,
          });
        }),
      state: () =>
        Object.freeze({
          ...foundationRuntimeState(plan, journal),
          managementAttempts: budget.snapshot().attempts,
          managementMaximum,
          controlAttempts: controlBudget.snapshot().attempts,
          controlMaximum: 2048,
          pendingTransport: transport.state(),
          closed,
        }),
      close() {
        transport.close();
        const s = transport.state();
        if (busy || s.pendingRequests !== 0 || s.unclosedResponses !== 0)
          return Object.freeze({ closed: false, unresolvedTransport: true });
        closed = true;
        machineToken = null;
        protectionBypass = null;
        return ownsBudget ? budget.close() : Object.freeze({ closed: true, unresolvedTransport: false });
      },
    });
  } catch {
    transport?.close();
    if (ownsBudget) budget.close();
    fail();
  }
}
