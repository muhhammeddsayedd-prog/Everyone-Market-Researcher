import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  createFoundationLiveRuntime,
  createFoundationLiveManagementBudget,
  foundationLiveAuxiliaryStorage,
} from './foundation-live-runtime.mjs';
import { isFoundationNativeDomainProbeBody } from './foundation-live-domain-probe.mjs';
import { fixture, syntheticBaselinePreflight } from './foundation-live-runtime-fixtures.mjs';
import { foundationAcceptancePlan } from '../../n8n/foundation/materialize-acceptance-case.mjs';
import { assertFoundationRuntimeRestorationAudit } from './foundation-runtime-control.mjs';
import { syntheticZeroSetup } from './foundation-live-runtime-resume-fixtures.mjs';

test('one genuine same-attempt early baseline plus one actual restoration audit completes the full307 runtime request bound', async () => {
  const f = fixture();
  let runtime, budget, early;
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: f.input.setup.sourceCommitSha, deadlineAt: f.input.deadlineAt },
      { directory: f.directory },
    );
    for (let i = 0; i < 127; i++) budget.admit();
    early = syntheticBaselinePreflight(
      {
        bindings: f.input.bindings,
        records: f.input.records,
        apiKey: f.input.managementKey,
        deadlineAt: f.input.deadlineAt,
        managementBudget: budget,
        admitManagementAttempt: () => budget.admit(),
      },
      { workflows: f.workflows },
    );
    const baselinePreflightReceipt = await early.read();
    assert.equal(budget.snapshot().attempts, 152);
    for (let i = 0; i < 26; i++) budget.admit(); // bounded Preview preparation;18cleanup still reserved
    const start = budget.snapshot().attempts;
    runtime = createFoundationLiveRuntime(f.input, {
      ...f.dependencies,
      managementBudget: budget,
      baselinePreflightReceipt,
    });
    assert.equal(runtime.checkOnly().setupDriftGuardGetCount, 0);
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    assert.equal(budget.snapshot().attempts - start, 109);
    const selected = foundationAcceptancePlan().cases.filter((v) => v.recommendedLive);
    assert.equal(selected.length, 23);
    // Counter/transport fixture only: all23drafts use the same valid harmless
    // graph here. Individual acceptance-case contents are tested separately.
    for (let i = 0; i < selected.length; i++)
      assert.equal((await runtime.saveCase('dispatch.vimeo')).status, 'case_draft_verified');
    assert.equal((await runtime.saveDomainProbe()).status, 'case_draft_verified');
    for (let i = 0; i < 2; i++)
      assert.equal((await runtime.verifyMachine()).status, 'owned_machine_metadata_unchanged');
    const beforeRestore = budget.snapshot().attempts;
    const restored = await runtime.restore();
    assert.equal(
      assertFoundationRuntimeRestorationAudit(restored, { plan: runtime.plan }).verifiedWorkflows,
      25,
    );
    assert.equal(budget.snapshot().attempts - beforeRestore, 124);
    assert.equal(budget.snapshot().attempts - start, 307);
    for (let i = 0; i < 18; i++) budget.admit();
    assert.equal(budget.snapshot().attempts, 503);
    assert.equal(budget.snapshot().maximum, 512);
    assert.equal(f.calls.filter((c) => c.method === 'PUT').length, 26 + 24 + 25);
    assert.throws(() =>
      createFoundationLiveRuntime(f.input, {
        ...f.dependencies,
        managementBudget: budget,
        baselinePreflightReceipt: { ...baselinePreflightReceipt },
      }),
    );
  } finally {
    runtime?.close();
    early?.close();
    budget?.close();
    f.cleanup();
  }
});

test('a reused early baseline never replaces the fresh per-write drift check or restores an external graph edit', async () => {
  const f = fixture();
  let runtime, budget, early;
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: f.input.setup.sourceCommitSha, deadlineAt: f.input.deadlineAt },
      { directory: f.directory },
    );
    early = syntheticBaselinePreflight(
      {
        bindings: f.input.bindings,
        records: f.input.records,
        apiKey: f.input.managementKey,
        deadlineAt: f.input.deadlineAt,
        managementBudget: budget,
        admitManagementAttempt: () => budget.admit(),
      },
      { workflows: f.workflows },
    );
    const receipt = await early.read(),
      wf00 = f.input.bindings.workflowRefs['WF-00'].id;
    f.workflows.get(wf00).name = 'SYNTHETIC_EXTERNAL_EDIT';
    runtime = createFoundationLiveRuntime(f.input, {
      ...f.dependencies,
      managementBudget: budget,
      baselinePreflightReceipt: receipt,
    });
    assert.equal((await runtime.setup()).status, 'blocked');
    assert.equal(
      f.calls.some((c) => c.method === 'PUT' && c.path.startsWith('/api/v1/workflows/' + wf00)),
      false,
    );
    assert.equal(f.workflows.get(wf00).name, 'SYNTHETIC_EXTERNAL_EDIT');
    const restored = await runtime.restore();
    assert.throws(() => assertFoundationRuntimeRestorationAudit(restored, { plan: runtime.plan }));
    assert.equal(f.workflows.get(wf00).name, 'SYNTHETIC_EXTERNAL_EDIT');
  } finally {
    runtime?.close();
    early?.close();
    budget?.close();
    f.cleanup();
  }
});

test('live composition is network-inert at construction and uses original25-guard setup/case/restore', async () => {
  const f = fixture();
  let runtime;
  try {
    runtime = f.create();
    assert.equal(f.calls.length, 0);
    assert.equal(runtime.checkOnly().status, 'local_runtime_ready');
    assert.equal(runtime.checkOnly().setupDriftGuardGetCount, 25);
    assert.equal(f.calls.length, 0);
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    assert.equal(runtime.state().managementAttempts, 134);
    const receipt = await runtime.saveCase('dispatch.vimeo');
    assert.equal(receipt.status, 'case_draft_verified');
    assert.equal(runtime.bindingFor('WF-00', { caseReceipt: receipt }).versionId, receipt.versionId);
    const domain = await runtime.saveDomainProbe();
    assert.equal(domain.status, 'case_draft_verified');
    const db = runtime.bindingFor('WF-99', { caseReceipt: domain });
    assert.equal(isFoundationNativeDomainProbeBody(db.body, { runtimeAudience: db.runtimeAudience }), true);
    assert.equal((await runtime.verifyMachine()).status, 'owned_machine_metadata_unchanged');
    assert.equal((await runtime.restore()).status, 'exact_staging_restored_unpublished');
    assert.equal((await runtime.finalAudit()).verifiedWorkflows, 25);
    assert.equal(
      [...f.workflows.values()].some((w) => w.active),
      false,
    );
    assert.equal(runtime.state().managementMaximum, 512);
    assert.equal(runtime.state().controlMaximum, 2048);
    const saved = ['runtime.jsonl', 'control.jsonl', 'management.jsonl']
      .map((p) => readFileSync(join(f.directory, p), 'utf8'))
      .join('');
    assert.equal(saved.includes(f.input.managementKey), false);
    assert.equal(saved.includes(f.input.machineToken), false);
    assert.equal(saved.includes(f.input.protectionBypass), false);
    runtime.close();
    runtime = null;
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('Vercel and runtime attempts share the pre-plan durable512 pool and preserve shutdown reserve', async () => {
  const f = fixture();
  let budget, runtime;
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: f.input.setup.sourceCommitSha, deadlineAt: f.input.deadlineAt },
      { directory: f.directory },
    );
    for (let i = 0; i < 45; i++) budget.admit({ host: 'api.vercel.com', method: 'GET', path: '/synthetic' });
    runtime = createFoundationLiveRuntime(f.input, { ...f.dependencies, managementBudget: budget });
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    assert.equal(runtime.state().managementAttempts, 179);
    for (let i = 0; i < 190; i++) budget.admit();
    const before = f.calls.length;
    assert.equal((await runtime.saveCase('dispatch.vimeo')).status, 'shared_management_reserve_required');
    assert.equal(f.calls.length, before);
    runtime.close();
    runtime = null;
    assert.equal(budget.snapshot().closed, false);
    assert.equal(budget.snapshot().attempts, 369);
    budget.close();
    budget = null;
  } finally {
    runtime?.close();
    budget?.close();
    f.cleanup();
  }
});

test('unclosed physical transport retains child lock rather than claiming process-safe cleanup', () => {
  const f = fixture();
  let runtime,
    pending = 1;
  try {
    runtime = createFoundationLiveRuntime(f.input, {
      ...f.dependencies,
      transportState: () => ({ pendingRequests: pending, unclosedResponses: pending }),
    });
    assert.deepEqual(runtime.close(), { closed: false, unresolvedTransport: true });
    assert.throws(() => f.create(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    pending = 0;
    assert.equal(runtime.close().closed, true);
    runtime = null;
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('exact staging drift blocks preflight without a mutation or replacement', async () => {
  const f = fixture();
  let runtime;
  try {
    f.workflows.values().next().value.versionId = 'foreign-version';
    runtime = f.create();
    assert.equal((await runtime.setup()).status, 'blocked');
    assert.equal(f.calls.length, 1);
    assert.equal(
      f.calls.every((c) => c.method === 'GET'),
      true,
    );
    assert.equal((await runtime.setup()).status, 'reconciliation_required');
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('exclusive operation lock and durable admission survive restarts without refilling counters', async () => {
  const f = fixture();
  let runtime;
  try {
    runtime = f.create();
    assert.throws(() => f.create(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.equal(f.calls.length, 0);
    await runtime.setup();
    runtime.close();
    runtime = null;
    runtime = f.create();
    assert.equal(runtime.state().managementAttempts, 134);
    assert.equal((await runtime.setup()).status, 'reconciliation_required');
    assert.equal(runtime.state().managementAttempts, 134);
    assert.equal(runtime.state().controlAttempts, 0);
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('unknown mutation acknowledgement is reconciled GET-only and never retried', async () => {
  const f = fixture({
    fault({ method }) {
      if (method === 'PATCH') throw Error('PRIVATE_REFLECTED_ERROR');
    },
  });
  let runtime;
  try {
    runtime = f.create();
    assert.equal((await runtime.setup()).status, 'reconciliation_required');
    const mutations = f.calls.filter((c) => c.method !== 'GET').length;
    assert.equal(mutations, 1);
    assert.equal((await runtime.setup()).status, 'reconciliation_required');
    assert.equal((await runtime.restore()).status, 'reconciliation_required');
    assert.equal((await runtime.reconcile()).mutationReplayAllowed, false);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 1);
    assert.equal(JSON.stringify(runtime.state()).includes('PRIVATE_REFLECTED_ERROR'), false);
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('dangling symbolic journal entries are rejected before journal adoption or append', () => {
  const f = fixture();
  let budget;
  const link = join(f.directory, 'preflight.jsonl');
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: f.input.setup.sourceCommitSha, deadlineAt: f.input.deadlineAt },
      { directory: f.directory },
    );
    // Windows junction creation needs no privileged symlink setting. The target
    // deliberately does not exist; existsSync alone must not classify it absent.
    symlinkSync(
      join(f.directory, 'missing-journal-target'),
      link,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(
      () => foundationLiveAuxiliaryStorage(budget, 'preflight'),
      /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
    );
  } finally {
    try {
      unlinkSync(link);
    } catch {}
    budget?.close();
    f.cleanup();
  }
});

test('final audit rejects malformed empty-array pinData after exact baseline restoration', async () => {
  const f = fixture();
  let runtime;
  try {
    runtime = f.create();
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    assert.equal((await runtime.restore()).status, 'exact_staging_restored_unpublished');
    f.workflows.values().next().value.pinData = [];
    await assert.rejects(runtime.finalAudit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
  } finally {
    runtime?.close();
    f.cleanup();
  }
});

test('zero-setup branded continuation reuses the exact old ledger and refuses missing or changed history', () => {
  const f = fixture(),
    z = syntheticZeroSetup();
  let budget;
  const path = join(f.directory, 'management.jsonl');
  try {
    writeFileSync(path, z.header);
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: z.checkpoint.sourceCommitSha, deadlineAt: z.checkpoint.deadlineAt },
      { directory: f.directory, now: z.now, zeroSetupProof: z.proof },
    );
    assert.equal(budget.snapshot().deadlineAt, z.checkpoint.deadlineAt);
    assert.equal(budget.snapshot().attempts, 0);
    assert.equal(readFileSync(path, 'utf8'), z.header);
    budget.close();
    budget = null;
    assert.throws(
      () =>
        createFoundationLiveManagementBudget(
          { sourceCommitSha: z.checkpoint.sourceCommitSha, deadlineAt: z.checkpoint.deadlineAt },
          { directory: f.directory, now: z.now, zeroSetupProof: structuredClone(z.proof) },
        ),
      /M03_ZERO_SETUP_BLOCKED/,
    );
    writeFileSync(path, z.header + JSON.stringify({ event: 'management_attempt', ordinal: 1 }) + '\n');
    assert.throws(
      () =>
        createFoundationLiveManagementBudget(
          { sourceCommitSha: z.checkpoint.sourceCommitSha, deadlineAt: z.checkpoint.deadlineAt },
          { directory: f.directory, now: z.now, zeroSetupProof: z.proof },
        ),
      /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
    );
    unlinkSync(path);
    assert.throws(
      () =>
        createFoundationLiveManagementBudget(
          { sourceCommitSha: z.checkpoint.sourceCommitSha, deadlineAt: z.checkpoint.deadlineAt },
          { directory: f.directory, now: z.now, zeroSetupProof: z.proof },
        ),
      /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
    );
    assert.throws(() => readFileSync(path), /ENOENT/);
  } finally {
    budget?.close();
    f.cleanup();
  }
});
