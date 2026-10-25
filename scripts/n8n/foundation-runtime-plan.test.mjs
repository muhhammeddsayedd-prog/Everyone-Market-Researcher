import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import {
  createFoundationRuntimePlan,
  materializeFoundationRuntimeCase,
  runtimeManagementCounts,
  createFoundationRuntimeBaseline,
} from './foundation-runtime-plan.mjs';

export function runtimeFixture() {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const transport = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const records = Object.keys(bindings.workflowRefs).map((key) =>
    JSON.parse(readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url))),
  );
  const setup = {
    version: 1,
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
    sourceCommitSha: 'a'.repeat(40),
    deploymentId: 'dpl_ProposedRuntimeOnly',
    audience: 'https://everyone-market-researcher-proposed-runtime-only.vercel.app',
    environment: 'preview',
    readyState: 'READY',
    protection: 'all_except_custom_domains',
    protectionVerified: true,
    protectionTransportVerified: true,
    sqlAudienceBindingVerified: true,
  };
  return { bindings, transport, records, setup };
}

test('restored baseline versions reject every unbranded continuation proof before plan construction', () => {
  const f = runtimeFixture();
  for (const projectVerifiedContinuationProof of [
    undefined,
    {},
    { windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77' },
    { 'SUB-NOTIFY': 'synthetic-untrusted-version', 'WF-90': 'synthetic-untrusted-version' },
  ]) {
    assert.throws(() => createFoundationRuntimeBaseline({ ...f, projectVerifiedContinuationProof }));
    assert.throws(() => createFoundationRuntimePlan({ ...f, projectVerifiedContinuationProof }));
  }
});

for (const activeWindowId of ['edbc6d11-7c1f-43a7-b745-1ded06deb29f', 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a'])
  test(`runtime window ${activeWindowId} refuses missing or copied authority rather than using the original source baseline`, () => {
    const f = runtimeFixture();
    assert.throws(() => createFoundationRuntimePlan({ ...f, activeWindowId }));
    for (const projectVerifiedContinuationProof of [
      undefined,
      {},
      { windowId: activeWindowId, sourceCommitSha: f.setup.sourceCommitSha },
      Object.fromEntries(f.records.map((record) => [record.key, record.versionId])),
    ])
      assert.throws(() =>
        createFoundationRuntimePlan({ ...f, activeWindowId, projectVerifiedContinuationProof }),
      );
  });

test('no-proof technical13 reconstruction retains the immutable actual runtime plan hash', () => {
  const original = runtimeFixture();
  const plan = createFoundationRuntimePlan({
    ...original,
    activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
    setup: {
      ...original.setup,
      sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
      deploymentId: 'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25',
      audience: 'https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app',
    },
  });
  // Immutable technical13 runtime header, separately preserved after cleanup.
  assert.equal(plan.planHash, '93a983e7e5acd2a03e1999576be9f9570da223ca0e2b77925152064c8e6ffac0');
});

test('genuine restored1024 proof changes only two validated output versions and preserves historical plans', async () => {
  const { syntheticProjectVerifiedContinuation } =
    await import('./foundation-live-project-verified-fixtures.mjs');
  const f = await syntheticProjectVerifiedContinuation({
    runtimeRestorationClosed: true,
    runtimeRestorationAllocation: true,
  });
  try {
    const original = runtimeFixture();
    const originalPlan = createFoundationRuntimePlan({
      ...original,
      activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
    });
    const canonicalBefore = JSON.stringify(original.records);
    const proof = f.claim(f.admit());
    const versions = f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof);
    assert.deepEqual(Object.keys(versions).sort(), ['SUB-NOTIFY', 'WF-90']);
    assert.equal(Object.isFrozen(versions), true);
    const module = await f.copy('foundation-runtime-plan.mjs');
    const input = {
      ...original,
      setup: { ...original.setup, sourceCommitSha: proof.sourceCommitSha },
      activeWindowId: proof.windowId,
      projectVerifiedContinuationProof: proof,
    };
    const baseline = module.createFoundationRuntimeBaseline(input);
    const plan = module.createFoundationRuntimePlan(input);
    assert.equal(plan.windowId, '4c602549-2c42-4ec3-9328-714d7cb66a77');
    assert.deepEqual(plan.baseline, baseline);
    assert.equal(baseline.length, 25);
    for (const row of baseline) {
      const old = originalPlan.baseline.find((b) => b.key === row.key);
      assert.equal(row.versionId, versions[row.key] ?? old.versionId);
      if (Object.hasOwn(versions, row.key)) assert.notEqual(row.versionId, old.versionId);
      assert.deepEqual({ ...row, versionId: old.versionId }, old);
    }
    assert.equal(JSON.stringify(original.records), canonicalBefore);
    assert.deepEqual(
      createFoundationRuntimePlan({ ...original, activeWindowId: originalPlan.windowId }),
      originalPlan,
    );
    for (const projectVerifiedContinuationProof of [structuredClone(proof), versions])
      assert.throws(() =>
        module.createFoundationRuntimeBaseline({ ...input, projectVerifiedContinuationProof }),
      );
    const changed = { ...input, records: structuredClone(input.records) };
    changed.records.find((r) => r.key === 'SUB-NOTIFY').versionId = versions['SUB-NOTIFY'];
    assert.throws(() => module.createFoundationRuntimeBaseline(changed));
    assert.throws(() => module.createFoundationRuntimePlan({ ...input, setup: original.setup }));
    assert.throws(() =>
      module.createFoundationRuntimePlan({ ...input, activeWindowId: originalPlan.windowId }),
    );
    const noProof = { ...input };
    delete noProof.projectVerifiedContinuationProof;
    assert.throws(() => module.createFoundationRuntimePlan(noProof));
  } finally {
    f.cleanup();
  }
});

for (const profile of [
  {
    name: 'settled17',
    options: { technical16Settled: true },
    window: 'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
  },
  {
    name: 'restored19 successor20',
    options: { technical19Restored: true, technical20SourceSelected: true },
    window: 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
  },
])
  test(`genuine ${profile.name} proof carries all25 restored versions only after canonical source validation`, async () => {
    const { syntheticProjectVerifiedContinuation } =
      await import('./foundation-live-project-verified-fixtures.mjs');
    const f = await syntheticProjectVerifiedContinuation(profile.options);
    try {
      const original = runtimeFixture(),
        canonicalBefore = JSON.stringify(original.records);
      const historical = createFoundationRuntimePlan({
        ...original,
        activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      });
      const proof = f.claim(f.admit()),
        versions = f.module.foundationProjectVerifiedContinuationRestoredBaselineVersions(proof);
      assert.equal(proof.windowId, profile.window);
      assert.equal(Object.isFrozen(versions), true);
      assert.deepEqual(Object.keys(versions).sort(), original.records.map((record) => record.key).sort());
      const module = await f.copy('foundation-runtime-plan.mjs');
      const input = {
        ...original,
        activeWindowId: proof.windowId,
        setup: { ...original.setup, sourceCommitSha: proof.sourceCommitSha },
        projectVerifiedContinuationProof: proof,
      };
      const baseline = module.createFoundationRuntimeBaseline(input),
        plan = module.createFoundationRuntimePlan(input);
      assert.equal(plan.windowId, proof.windowId);
      assert.deepEqual(plan.baseline, baseline);
      assert.equal(baseline.length, 25);
      for (const row of baseline) {
        const canonical = historical.baseline.find((record) => record.key === row.key);
        assert.equal(row.versionId, versions[row.key]);
        assert.deepEqual({ ...row, versionId: canonical.versionId }, canonical);
      }
      assert.equal(JSON.stringify(original.records), canonicalBefore);
      for (const forged of [structuredClone(proof), versions, Object.freeze({ ...proof })]) {
        assert.throws(() =>
          module.createFoundationRuntimeBaseline({ ...input, projectVerifiedContinuationProof: forged }),
        );
        assert.throws(() =>
          module.createFoundationRuntimePlan({ ...input, projectVerifiedContinuationProof: forged }),
        );
      }
      const changed = { ...input, records: structuredClone(input.records) };
      changed.records.find((record) => record.key === 'WF-10').versionId = versions['WF-10'];
      changed.records.find((record) => record.key === 'WF-10').workflow.nodes[0].position = [42, 42];
      assert.throws(() => module.createFoundationRuntimeBaseline(changed));
      assert.throws(() => module.createFoundationRuntimePlan({ ...input, setup: original.setup }));
      assert.throws(() =>
        module.createFoundationRuntimePlan({ ...input, activeWindowId: historical.windowId }),
      );
      const noProof = { ...input };
      delete noProof.projectVerifiedContinuationProof;
      assert.throws(() => module.createFoundationRuntimePlan(noProof));
      assert.deepEqual(
        createFoundationRuntimePlan({ ...original, activeWindowId: historical.windowId }),
        historical,
      );
    } finally {
      f.cleanup();
    }
  });

test('fresh active window compiles exact new response guards while preserving reviewed inactive baseline', () => {
  const f = runtimeFixture(),
    old = createFoundationRuntimePlan(f);
  const fresh = createFoundationRuntimePlan({ ...f, activeWindowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc' });
  assert.equal(fresh.windowId, '38b3708d-61b0-41d2-8170-5ed91c66b4dc');
  assert.equal(fresh.transport.windowId, fresh.windowId);
  assert.deepEqual(fresh.baseline, old.baseline);
  assert.deepEqual(createFoundationRuntimeBaseline(f), old.baseline);
  assert.equal(f.transport.windowId, 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
  assert.equal(JSON.stringify(fresh.runtime).includes('38b3708d-61b0-41d2-8170-5ed91c66b4dc'), true);
  const next = createFoundationRuntimePlan({ ...f, activeWindowId: 'eda4fae1-1e19-47db-81b8-beac1a4ed883' });
  assert.equal(next.windowId, 'eda4fae1-1e19-47db-81b8-beac1a4ed883');
  assert.deepEqual(next.baseline, old.baseline);
  assert.equal(JSON.stringify(next.runtime).includes(next.windowId), true);
  assert.equal(JSON.stringify(next.runtime).includes(fresh.windowId), false);
  const fourth = createFoundationRuntimePlan({
    ...f,
    activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
  });
  assert.equal(fourth.windowId, '3c46c791-e140-4eb9-890a-eecfa251f65e');
  assert.equal(fourth.transport.windowId, fourth.windowId);
  assert.deepEqual(fourth.baseline, old.baseline);
  assert.equal(JSON.stringify(fourth.runtime).includes(fourth.windowId), true);
  for (const retired of [fresh.windowId, next.windowId])
    assert.equal(JSON.stringify(fourth.runtime).includes(retired), false);
  assert.throws(() =>
    createFoundationRuntimePlan({ ...f, activeWindowId: '11111111-1111-4111-8111-111111111111' }),
  );
  const changed = structuredClone(f);
  changed.records[0].versionId = '11111111-1111-4111-8111-111111111111';
  assert.throws(() => createFoundationRuntimeBaseline(changed));
});

test('verified WF00 restore carries one exact native pin outside all editable PUT bodies', () => {
  const f = runtimeFixture(),
    plan = createFoundationRuntimePlan(f),
    wf00 = plan.baseline.find((v) => v.key === 'WF-00');
  assert.equal(wf00.versionId, 'f5f755b7-9683-4fb6-a26d-87b001127244');
  assert.deepEqual(wf00.nativeReadonlySettings, { binaryMode: 'separate' });
  assert.equal(Object.isFrozen(wf00.nativeReadonlySettings), true);
  assert.equal(Object.hasOwn(wf00.body.settings, 'binaryMode'), false);
  assert.equal(plan.baseline.filter((v) => Object.hasOwn(v, 'nativeReadonlySettings')).length, 1);
  for (const value of [undefined, { binaryMode: 'combined' }, { binaryMode: 'SYNTHETIC_PRIVATE_MODE' }]) {
    const changed = structuredClone(f);
    changed.records.find((v) => v.key === 'WF-00').nativeReadonlySettings = value;
    assert.throws(() => createFoundationRuntimeBaseline(changed));
  }
});

test('plan binds exact25 checkpoint IDs/versions, future Preview rules and finite native order', () => {
  const f = runtimeFixture();
  const p = createFoundationRuntimePlan(f);
  assert.equal(p.kind, 'proposed_finite_runtime_transition');
  assert.equal(p.hostedActionsPerformed, false);
  assert.equal(p.baseline.length, 25);
  assert.equal(p.publishKeys.length, 7);
  assert.equal(p.publishKeys.includes('WF-00'), false);
  assert.equal(p.publishKeys.includes('WF-99'), false);
  assert.deepEqual(
    p.setupSteps.slice(0, 7).map((s) => [s.kind, s.key]),
    [
      ['save', 'SUB-NOTIFY'],
      ['publish', 'SUB-NOTIFY'],
      ['save', 'WF-90'],
      ['publish', 'WF-90'],
      ['unpublish', 'SUB-NOTIFY'],
      ['save', 'SUB-NOTIFY'],
      ['publish', 'SUB-NOTIFY'],
    ],
  );
  assert.equal(Object.isFrozen(p), true);
  assert.equal(Object.isFrozen(p.baseline[0].body), true);
  assert.equal(p.maximumManagementRequests, 512);
  assert.equal(runtimeManagementCounts(p).setup, 135);
  assert.equal(runtimeManagementCounts(p).restore, 124);
  assert.equal(runtimeManagementCounts(p).finalAudit, 25);
});

test('published bodies have disabled schedules, exact runtime URLs,24 canonical error links and no actor release', () => {
  const p = createFoundationRuntimePlan(runtimeFixture());
  const saves = p.setupSteps.filter((s) => s.kind === 'save');
  assert.equal(saves.length, 26);
  assert.equal(p.runtime.filter((r) => Object.hasOwn(r.body.settings, 'errorWorkflow')).length, 24);
  for (const r of p.runtime) {
    assert.equal(r.body.settings.availableInMCP, false);
    for (const n of r.body.nodes) {
      if (n.type === 'n8n-nodes-base.scheduleTrigger') assert.equal(n.disabled, true);
      if (n.credentials?.httpCustomAuth?.id === 'EmrM03Machine19')
        assert.equal(n.parameters.url, p.setup.audience + '/api/internal/n8n/foundation');
      if (n.name === 'Start approved actor') assert.equal(n.disabled, true);
    }
  }
  assert.equal(p.machinePatch.isPartialData, true);
  assert.deepEqual(Object.keys(p.machinePatch.data).sort(), ['allowedDomains', 'allowedHttpRequestDomains']);
  assert.equal(JSON.stringify(p.machinePatch).includes('Authorization'), false);
});

test('unknown or changed checkpoint records and unverified setup fail before any port exists', () => {
  for (const change of [
    (f) => {
      f.records[0].versionId = 'unknown-version';
    },
    (f) => {
      f.records[0].workflow.nodes[0].disabled = true;
    },
    (f) => {
      f.bindings.workflowRefs['WF-00'].id = 'unowned';
    },
    (f) => {
      f.setup.sqlAudienceBindingVerified = false;
    },
    (f) => {
      f.setup.protectionTransportVerified = false;
    },
    (f) => {
      f.setup.branch = 'main';
    },
    (f) => {
      f.setup.projectId = 'another-project';
    },
    (f) => {
      f.setup.audience = f.transport.audience;
    },
  ]) {
    const f = runtimeFixture();
    change(f);
    assert.throws(() => createFoundationRuntimePlan(f), /^Error: FOUNDATION_RUNTIME_PLAN_BLOCKED$/);
  }
  assert.equal(Object.keys(foundationRuntimeCheckpoint.workflows).length, 25);
});

test('finite case is a source-defined MCP-visible draft with one Manual entry, no publish and no schedules', () => {
  const p = createFoundationRuntimePlan(runtimeFixture());
  const c = materializeFoundationRuntimeCase(p, 'dispatch.vimeo');
  assert.equal(c.key, 'WF-00');
  assert.equal(c.publish, false);
  assert.equal(c.body.settings.availableInMCP, true);
  assert.equal(
    c.body.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger' && n.disabled !== true).length,
    1,
  );
  assert.equal(
    c.body.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger' && n.disabled !== true).length,
    0,
  );
  assert.equal(c.managementRequests, 3);
  assert.throws(() => materializeFoundationRuntimeCase(p, 'arbitrary-case'));
});

test('approved local retention design reaches every runtime save and case without changing the staged baseline', () => {
  const p = createFoundationRuntimePlan(runtimeFixture());
  assert.equal(p.retentionPolicy.approval.commit, 'eee9a277c6a7d63fffe967811c92a7fd50c15b14');
  assert.equal(p.retentionPolicy.hostedActionsAllowed, false);
  assert.equal(p.retentionPolicy.executionAllowed, false);
  const manual = new Set(['WF-00', 'WF-91', 'WF-99', 'SUB-INGEST', 'SUB-COST']);
  const manualOnly = new Set(['WF-00', 'WF-99', 'SUB-INGEST', 'SUB-COST']);
  const expected = (key) => ({
    saveDataSuccessExecution: manualOnly.has(key) ? 'none' : 'all',
    saveDataErrorExecution: manualOnly.has(key) ? 'none' : 'all',
    saveManualExecutions: manual.has(key),
    saveExecutionProgress: false,
  });
  for (const row of [...p.runtime, ...p.setupSteps.filter((s) => s.kind === 'save')])
    for (const [field, value] of Object.entries(expected(row.key)))
      assert.equal(row.body.settings[field], value, row.key + ':' + field);
  for (const row of p.baseline) {
    assert.equal(row.body.settings.saveDataSuccessExecution, 'none');
    assert.equal(row.body.settings.saveDataErrorExecution, 'none');
    assert.equal(row.body.settings.saveManualExecutions, false);
    assert.equal(row.body.settings.saveExecutionProgress, false);
  }
  const draft = materializeFoundationRuntimeCase(p, 'dispatch.vimeo');
  for (const [field, value] of Object.entries(expected(draft.key)))
    assert.equal(draft.body.settings[field], value);
  assert.equal(draft.body.settings.availableInMCP, true);
  assert.equal(runtimeManagementCounts(p, 23).nominalTotal, 353);
});
