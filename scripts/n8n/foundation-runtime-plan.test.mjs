import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import {
  createFoundationRuntimePlan,
  materializeFoundationRuntimeCase,
  runtimeManagementCounts,
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
  assert.equal(runtimeManagementCounts(p).setup, 134);
  assert.equal(runtimeManagementCounts(p).restore, 99);
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
