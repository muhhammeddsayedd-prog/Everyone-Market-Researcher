import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync,
  writeFileSync,
  symlinkSync,
  unlinkSync,
  mkdirSync,
  rmdirSync,
  renameSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
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
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';

test('shared native fixture keeps settings/name-only versions and rotates structural workflow versions', async () => {
  const f = fixture();
  try {
    const workflow = f.workflows.get(f.input.bindings.workflowRefs['SUB-NOTIFY'].id);
    const path = '/api/v1/workflows/' + workflow.id + '?excludePinnedData=true';
    const writePath = '/api/v1/workflows/' + workflow.id + '?publishIfActive=false';
    const originalVersion = workflow.versionId;
    const settingsBody = {
      name: workflow.name + ' synthetic renamed',
      nodes: structuredClone(workflow.nodes),
      connections: structuredClone(workflow.connections),
      settings: { ...structuredClone(workflow.settings), executionTimeout: 899 },
    };
    const settingsSave = await f.dependencies.send('PUT', writePath, settingsBody);
    assert.equal(settingsSave.status, 200);
    assert.equal(settingsSave.body.versionId, originalVersion);
    assert.equal(settingsSave.body.name, settingsBody.name);
    assert.equal(settingsSave.body.settings.executionTimeout, 899);
    const settingsRead = await f.dependencies.send('GET', path);
    assert.equal(settingsRead.body.versionId, originalVersion);
    assert.deepEqual(settingsRead.body.nodes, settingsBody.nodes);
    const structuralBody = { ...settingsBody, nodes: structuredClone(settingsBody.nodes) };
    structuralBody.nodes[0].position = [
      structuralBody.nodes[0].position[0] + 1,
      structuralBody.nodes[0].position[1],
    ];
    const structuralSave = await f.dependencies.send('PUT', writePath, structuralBody);
    assert.equal(structuralSave.status, 200);
    assert.notEqual(structuralSave.body.versionId, originalVersion);
    assert.deepEqual(structuralSave.body.nodes, structuralBody.nodes);
    assert.equal((await f.dependencies.send('GET', path)).body.versionId, structuralSave.body.versionId);
    assert.equal(f.calls.length, 4);
  } finally {
    f.cleanup();
  }
});

for (const profile of [640, 704, 832])
  test(`genuine${profile} allocation retains every charged request and the shared2560 ceiling without replacing historical headers`, async () => {
    for (const [controlAttempts, expectedLimit] of [
      [profile === 832 ? 740 : profile === 704 ? 588 : 486, profile],
      [2048, 512],
    ]) {
      const f = await syntheticProjectVerifiedContinuation(
        profile === 832
          ? { runtimePreparationClosed: true, runtimeMetadataAllocation: true }
          : profile === 704
            ? { catalogReadonly: true, catalogManagementAllocation: true }
            : { closedFixture: true },
      );
      let budget;
      try {
        const before = readFileSync(f.paths.management, 'utf8'),
          proof = f.claim(f.admit()),
          module = await f.copy('foundation-live-runtime.mjs');
        budget = module.createFoundationLiveManagementBudget(
          { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
          {
            directory: dirname(f.paths.management),
            now: f.now,
            projectVerifiedContinuationProof: proof,
            controlAttempts: () => controlAttempts,
          },
        );
        assert.equal(budget.snapshot().attempts, profile === 832 ? 401 : profile === 704 ? 288 : 237);
        assert.equal(budget.snapshot().carriedAttempts, profile >= 704 ? 11 : 10);
        assert.equal(budget.snapshot().maximum, profile);
        while (budget.snapshot().attempts < expectedLimit) budget.admit();
        const atLimit = readFileSync(f.paths.management, 'utf8');
        assert.equal(atLimit.startsWith(before), true);
        assert.equal(budget.snapshot().attempts, expectedLimit);
        assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
        assert.equal(readFileSync(f.paths.management, 'utf8'), atLimit);
        if (controlAttempts === 2048) assert.equal(budget.snapshot().attempts + controlAttempts, 2560);
      } finally {
        budget?.close();
        f.cleanup();
      }
    }
  });

for (const profile of [640, 704, 832])
  test(`genuine${profile} requires current Control custody and conservatively retains an uncertain append charge`, async () => {
    const f = await syntheticProjectVerifiedContinuation(
      profile === 832
        ? { runtimePreparationClosed: true, runtimeMetadataAllocation: true }
        : profile === 704
          ? { catalogReadonly: true, catalogManagementAllocation: true }
          : { closedFixture: true },
    );
    const initialControl = profile === 832 ? 740 : profile === 704 ? 588 : 486;
    const initialManagement = profile === 832 ? 401 : profile === 704 ? 288 : 237;
    let budget,
      moved = false,
      directoryCreated = false;
    const saved = f.paths.management + '.synthetic-owned-backup';
    try {
      const proof = f.claim(f.admit()),
        module = await f.copy('foundation-live-runtime.mjs'),
        args = { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        dependencies = {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
        };
      assert.throws(
        () => module.createFoundationLiveManagementBudget(args, dependencies),
        /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
      );
      assert.throws(
        () =>
          module.createFoundationLiveManagementBudget(args, {
            ...dependencies,
            controlAttempts: () => initialControl - 1,
          }),
        /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
      );
      budget = module.createFoundationLiveManagementBudget(args, {
        ...dependencies,
        controlAttempts: () => initialControl,
      });
      renameSync(f.paths.management, saved);
      moved = true;
      mkdirSync(f.paths.management);
      directoryCreated = true;
      assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
      assert.equal(budget.snapshot().attempts, initialManagement + 1);
      assert.equal(budget.snapshot().stopped, true);
      assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
      assert.equal(budget.snapshot().attempts, initialManagement + 1);
    } finally {
      budget?.close();
      if (directoryCreated) rmdirSync(f.paths.management);
      if (moved) renameSync(saved, f.paths.management);
      f.cleanup();
    }
  });

for (const profile of [640, 704, 832])
  test(`a plain requested${profile} profile cannot raise the historical512 budget or require a new callback`, () => {
    const f = fixture();
    let budget;
    try {
      budget = createFoundationLiveManagementBudget(
        {
          sourceCommitSha: f.input.setup.sourceCommitSha,
          deadlineAt: f.input.deadlineAt,
          managementMaximum: profile,
        },
        {
          directory: f.directory,
          managementMaximum: profile,
          controlAttempts: () => {
            throw Error('UNTRUSTED_CALLBACK_NOT_USED');
          },
        },
      );
      assert.equal(budget.snapshot().maximum, 512);
      assert.equal(budget.snapshot().attempts, 0);
    } finally {
      budget?.close();
      f.cleanup();
    }
  });

test('only the approved genuine Management allocation carries152 charged attempts into the cumulative576 pool', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  let budget;
  try {
    const prior = readFileSync(f.paths.management, 'utf8'),
      proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => 384,
      },
    );
    assert.equal(budget.snapshot().attempts, 152);
    assert.equal(budget.snapshot().maximum, 576);
    for (let i = 152; i < 576; i++) budget.admit();
    const atCap = readFileSync(f.paths.management, 'utf8');
    assert.equal(budget.snapshot().attempts, 576);
    assert.equal(budget.snapshot().carriedAttempts, 10);
    assert.equal(budget.snapshot().mainAttempts, 566);
    assert.equal(atCap.startsWith(prior), true);
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.equal(readFileSync(f.paths.management, 'utf8'), atCap);
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('expanded Management admission preserves the combined2560 ceiling before any new durable intent', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  let budget;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => 2048,
      },
    );
    for (let i = 152; i < 512; i++) budget.admit();
    const before = readFileSync(f.paths.management, 'utf8');
    assert.equal(budget.snapshot().maximum, 576);
    assert.equal(budget.snapshot().attempts + 2048, 2560);
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.equal(readFileSync(f.paths.management, 'utf8'), before);
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('an uncertain576 journal append stays charged and stops paired Control at the combined boundary', async () => {
  for (const atBoundary of [false, true]) {
    const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
    let budget,
      controlBudget,
      moved = false,
      directoryCreated = false;
    const saved = f.paths.management + '.synthetic-owned-backup';
    try {
      const proof = f.claim(f.admit()),
        runtime = await f.copy('foundation-live-runtime.mjs'),
        control = await f.copy('foundation-control-state.mjs');
      budget = runtime.createFoundationLiveManagementBudget(
        { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
        {
          directory: dirname(f.paths.management),
          now: f.now,
          projectVerifiedContinuationProof: proof,
          controlAttempts: () => controlBudget?.snapshot().attempts ?? 384,
        },
      );
      const journal = control.createFoundationControlJournal({
        previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
        durableAppend() {},
      });
      controlBudget = control.createFoundationControlBudget({
        journal,
        now: f.now,
        deadlineAt: proof.deadlineAt,
        projectVerifiedContinuationProof: proof,
        managementAttempts: () => budget.snapshot().attempts,
      });
      if (atBoundary) {
        while (budget.snapshot().attempts < 512) budget.admit();
        while (controlBudget.snapshot().attempts < 2047) controlBudget.admit({ kind: 'discovery' });
      }
      const before = budget.snapshot().attempts;
      renameSync(f.paths.management, saved);
      moved = true;
      mkdirSync(f.paths.management);
      directoryCreated = true;
      // This owned synthetic path fails before any network transport exists.
      // An append/fsync/close failure may be uncertain in production, so its
      // attempted ordinal must remain visible to the paired Control budget.
      assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
      assert.equal(budget.snapshot().attempts, before + 1);
      assert.equal(budget.snapshot().attempts, atBoundary ? 513 : 153);
      assert.equal(budget.snapshot().stopped, true);
      assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
      assert.equal(budget.snapshot().attempts, before + 1);
      if (atBoundary) {
        assert.throws(() => controlBudget.admit({ kind: 'discovery' }), /FOUNDATION_CONTROL_STATE_BLOCKED/);
        assert.equal(controlBudget.snapshot().attempts, 2047);
        assert.equal(budget.snapshot().attempts + controlBudget.snapshot().attempts, 2560);
      }
    } finally {
      budget?.close();
      if (directoryCreated) rmdirSync(f.paths.management);
      if (moved) renameSync(saved, f.paths.management);
      f.cleanup();
    }
  }
});

test('approved runtime state and existing shutdown reserves use576 without resetting prior Management or Control usage', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true }),
    live = fixture();
  let budget, runtime, controlBudget;
  try {
    const proof = f.claim(f.admit()),
      module = await f.copy('foundation-live-runtime.mjs'),
      control = await f.copy('foundation-control-state.mjs');
    budget = module.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => controlBudget?.snapshot().attempts ?? 384,
      },
    );
    const journal = control.createFoundationControlJournal({
      previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      durableAppend() {},
    });
    controlBudget = control.createFoundationControlBudget({
      journal,
      now: f.now,
      deadlineAt: proof.deadlineAt,
      projectVerifiedContinuationProof: proof,
      managementAttempts: () => budget.snapshot().attempts,
    });
    runtime = module.createFoundationLiveRuntime(
      {
        ...live.input,
        activeWindowId: proof.windowId,
        setup: { ...live.input.setup, sourceCommitSha: proof.sourceCommitSha },
        deadlineAt: proof.deadlineAt,
      },
      { ...live.dependencies, managementBudget: budget, controlJournal: journal, controlBudget, now: f.now },
    );
    assert.equal(runtime.checkOnly().managementMaximum, 576);
    assert.equal(runtime.state().managementMaximum, 576);
    assert.equal(runtime.state().managementAttempts, 152);
    assert.equal(runtime.state().controlAttempts, 384);
    assert.equal((await runtime.setup()).status, 'runtime_setup_verified');
    for (let i = budget.snapshot().attempts; i < 371; i++) budget.admit();
    const before = live.calls.length;
    assert.equal((await runtime.saveCase('dispatch.vimeo')).status, 'case_draft_verified');
    assert.equal(live.calls.length - before, 3);
    assert.equal(budget.snapshot().attempts, 374);
    assert.equal((await runtime.restore()).status, 'exact_staging_restored_unpublished');
    assert.equal(runtime.state().managementMaximum, 576);
    assert.equal(runtime.state().controlAttempts, 384);
  } finally {
    runtime?.close();
    budget?.close();
    live.cleanup();
    f.cleanup();
  }
});

test('expanded Management rejects missing, invalid, throwing or decreasing Control snapshots without adding an intent', async () => {
  for (const snapshot of [
    undefined,
    () => NaN,
    () => -1,
    () => 383,
    () => 2049,
    () => 384.5,
    () => {
      throw Error('PRIVATE_CALLBACK_VALUE');
    },
  ]) {
    const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
    let budget;
    try {
      const proof = f.claim(f.admit()),
        runtime = await f.copy('foundation-live-runtime.mjs'),
        before = readFileSync(f.paths.management, 'utf8');
      assert.throws(() => {
        budget = runtime.createFoundationLiveManagementBudget(
          { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
          {
            directory: dirname(f.paths.management),
            now: f.now,
            projectVerifiedContinuationProof: proof,
            ...(snapshot === undefined ? {} : { controlAttempts: snapshot }),
          },
        );
      }, /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
      assert.equal(readFileSync(f.paths.management, 'utf8'), before);
    } finally {
      budget?.close();
      f.cleanup();
    }
  }
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  let budget,
    controlAttempts = 385;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      {
        directory: dirname(f.paths.management),
        now: f.now,
        projectVerifiedContinuationProof: proof,
        controlAttempts: () => controlAttempts,
      },
    );
    budget.admit();
    const before = readFileSync(f.paths.management, 'utf8');
    controlAttempts = 384;
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.equal(readFileSync(f.paths.management, 'utf8'), before);
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('a plain requested576 cap does not change the historical default512 budget', () => {
  const f = fixture();
  let budget;
  try {
    budget = createFoundationLiveManagementBudget(
      {
        sourceCommitSha: f.input.setup.sourceCommitSha,
        deadlineAt: f.input.deadlineAt,
        managementMaximum: 576,
      },
      {
        directory: f.directory,
        managementMaximum: 576,
        controlAttempts: () => {
          throw Error('NOT_CALLED');
        },
      },
    );
    assert.equal(budget.snapshot().maximum, 512);
    for (let i = 0; i < 512; i++) budget.admit();
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.equal(budget.snapshot().attempts, 512);
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('one genuine same-attempt early baseline plus one actual restoration audit completes the full308 runtime request bound', async () => {
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
    assert.equal(budget.snapshot().attempts - start, 110);
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
    assert.equal(budget.snapshot().attempts - start, 308);
    for (let i = 0; i < 18; i++) budget.admit();
    assert.equal(budget.snapshot().attempts, 504);
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
    assert.equal(runtime.state().managementAttempts, 135);
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
    assert.equal(runtime.state().managementAttempts, 180);
    for (let i = 0; i < 190; i++) budget.admit();
    const before = f.calls.length;
    assert.equal((await runtime.saveCase('dispatch.vimeo')).status, 'shared_management_reserve_required');
    assert.equal(f.calls.length, before);
    runtime.close();
    runtime = null;
    assert.equal(budget.snapshot().closed, false);
    assert.equal(budget.snapshot().attempts, 370);
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
    assert.equal(runtime.state().managementAttempts, 135);
    assert.equal((await runtime.setup()).status, 'reconciliation_required');
    assert.equal(runtime.state().managementAttempts, 135);
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
