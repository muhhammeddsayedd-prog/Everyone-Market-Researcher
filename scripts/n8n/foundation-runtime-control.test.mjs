import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { createFoundationRuntimePlan, materializeFoundationRuntimeCase } from './foundation-runtime-plan.mjs';
import { prepareFoundationRuntimeMachinePatch } from './foundation-runtime-machine.mjs';
import {
  createFoundationRuntimeJournal,
  foundationRuntimeState,
  foundationRuntimeRequestAllowed,
  runFoundationRuntimeSetup,
  saveFoundationRuntimeCase,
  restoreFoundationRuntime,
  reconcileFoundationRuntimeReadOnly,
  runtimeGraphHash,
  assertFoundationRuntimeCaseReceipt,
} from './foundation-runtime-control.mjs';
import * as runtimeControl from './foundation-runtime-control.mjs';
import * as checkpointDiagnostics from './foundation-runtime-checkpoint.mjs';

test('editable settings comparison explicitly isolates only known native binary mode without relaxing raw guards', () => {
  const f = fixture(),
    baseline = { ...f.plan.baseline.find((v) => v.key === 'WF-00') },
    dto = structuredClone(f.workflows.get(baseline.id));
  delete baseline.nativeReadonlySettings;
  delete dto.settings.binaryMode;
  assert.deepEqual(checkpointDiagnostics.foundationNativeReadonlySettings(dto.settings), {
    binaryMode: null,
  });
  for (const binaryMode of ['separate', 'combined']) {
    dto.settings.binaryMode = binaryMode;
    assert.deepEqual(checkpointDiagnostics.foundationNativeReadonlySettings(dto.settings), { binaryMode });
    assert.deepEqual(checkpointDiagnostics.foundationEditableSettings(dto.settings), baseline.body.settings);
    assert.notEqual(runtimeGraphHash(dto), runtimeGraphHash(baseline.body));
    assert.equal(
      checkpointDiagnostics.foundationRuntimeGraphHash(dto, { editableSettingsOnly: true }),
      runtimeGraphHash(baseline.body),
    );
    assert.deepEqual(
      checkpointDiagnostics.diagnoseFoundationRuntimeBaseline(dto, baseline, f.plan.projectId).failedChecks,
      ['graph_settings'],
    );
    assert.deepEqual(
      checkpointDiagnostics.diagnoseFoundationRuntimeBaseline(dto, baseline, f.plan.projectId, {
        editableSettingsOnly: true,
      }).failedChecks,
      [],
    );
    assert.equal(
      checkpointDiagnostics.diagnoseFoundationRuntimeBaselineVariants(dto, baseline).settingsCategories
        .otherEqual,
      false,
      'historical forensic categories remain raw',
    );
  }
});

test('editable settings deny invalid native mode and retain every unknown/resolver/editable mismatch', () => {
  const f = fixture(),
    baseline = f.plan.baseline.find((v) => v.key === 'WF-00');
  for (const binaryMode of ['SYNTHETIC_PRIVATE_MODE', '', null, undefined, false, {}, []]) {
    const settings = { ...baseline.body.settings, binaryMode };
    assert.throws(() => checkpointDiagnostics.foundationNativeReadonlySettings(settings), {
      message: 'FOUNDATION_RUNTIME_CONTROL_BLOCKED',
    });
    assert.throws(() => checkpointDiagnostics.foundationEditableSettings(settings), {
      message: 'FOUNDATION_RUNTIME_CONTROL_BLOCKED',
    });
  }
  let getterCalls = 0;
  for (const property of ['binaryMode', 'executionTimeout']) {
    const settings = { ...baseline.body.settings };
    Object.defineProperty(settings, property, {
      enumerable: true,
      get() {
        getterCalls++;
        throw Error('SYNTHETIC_PRIVATE_GETTER');
      },
    });
    assert.throws(() => checkpointDiagnostics.foundationEditableSettings(settings));
  }
  assert.equal(getterCalls, 0);
  for (const mutate of [
    (s) => (s.credentialResolverId = 'SYNTHETIC_PRIVATE_RESOLVER'),
    (s) => (s.credentialResolverId = ''),
    (s) => (s.syntheticUnknownSetting = true),
    (s) => (s.executionTimeout = 123),
    (s) => (s.saveManualExecutions = true),
    (s) => (s.availableInMCP = true),
  ]) {
    const dto = structuredClone(f.workflows.get(baseline.id));
    dto.settings.binaryMode = 'separate';
    mutate(dto.settings);
    assert.notEqual(
      checkpointDiagnostics.foundationRuntimeGraphHash(dto, { editableSettingsOnly: true }),
      runtimeGraphHash(baseline.body),
    );
    const diagnostic = checkpointDiagnostics.diagnoseFoundationRuntimeBaseline(
      dto,
      baseline,
      f.plan.projectId,
      {
        editableSettingsOnly: true,
      },
    );
    assert.deepEqual(diagnostic.failedChecks, ['graph_settings']);
    assert.doesNotMatch(JSON.stringify(diagnostic), /SYNTHETIC_PRIVATE|credentialResolver|syntheticUnknown/);
  }
});

test('fixed WF00 forensics identify reviewed component variants without adopting their version', () => {
  const f = fixture(),
    b = f.plan.baseline.find((v) => v.key === 'WF-00'),
    dto = structuredClone(f.workflows.get(b.id));
  delete dto.settings.binaryMode;
  for (const n of dto.nodes) if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
  dto.settings.availableInMCP = true;
  dto.settings.saveManualExecutions = true;
  dto.versionId = 'SYNTHETIC_PRIVATE_NEW_VERSION';
  const result = checkpointDiagnostics.diagnoseFoundationRuntimeBaselineVariants(dto, b);
  assert.equal(result.knownVariants.stagedC01ManualGraphEqual, true);
  assert.equal(result.knownVariants.c01RetentionGraphEqual, false);
  assert.equal(result.nodeCategories.behaviorEqual, false);
  assert.equal(result.nodeCategories.parametersEqual, true);
  assert.equal(result.settingsCategories.retentionEqual, false);
  assert.equal(result.settingsCategories.mcpVisibilityEqual, false);
  assert.equal(result.settingsCategories.otherEqual, true);
  assert.deepEqual(runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId).failedChecks, [
    'version_mismatch',
    'graph_nodes',
    'graph_settings',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|versionId|parameters":|sha256/);
});

test('fixed WF00 forensics classify unknown edits by fixed categories and never print field names or values', () => {
  const f = fixture(),
    b = f.plan.baseline.find((v) => v.key === 'WF-00'),
    dto = structuredClone(f.workflows.get(b.id));
  dto.settings.SYNTHETIC_PRIVATE_FIELD = 'SYNTHETIC_PRIVATE_SETTING';
  dto.nodes[0].parameters = { private: 'SYNTHETIC_PRIVATE_NODE' };
  dto.nodes[0].position = [99, 88];
  const result = checkpointDiagnostics.diagnoseFoundationRuntimeBaselineVariants(dto, b);
  assert.equal(result.nodeCategories.parametersEqual, false);
  assert.equal(result.nodeCategories.layoutEqual, false);
  assert.equal(result.settingsCategories.otherEqual, false);
  assert.equal(Object.values(result.knownVariants).some(Boolean), false);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|99|88/);
});

test('pure baseline diagnostic reports every fixed mismatch without copying external values', () => {
  const f = fixture(),
    b = f.plan.baseline.find((v) => v.key === 'WF-00');
  const dto = structuredClone(f.workflows.get(b.id));
  const good = runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId);
  assert.deepEqual(good.failedChecks, []);
  assert.deepEqual(good.components, {
    nameEqual: true,
    nodesEqual: true,
    connectionsEqual: true,
    settingsEqual: true,
  });
  dto.versionId = 'SYNTHETIC_PRIVATE_VERSION';
  dto.name = 'SYNTHETIC_PRIVATE_NAME';
  dto.settings.executionTimeout = 123;
  dto.nodes[0].parameters = { token: 'SYNTHETIC_PRIVATE_NODE_VALUE' };
  const bad = runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId);
  assert.deepEqual(bad.failedChecks, ['version_mismatch', 'graph_name', 'graph_nodes', 'graph_settings']);
  assert.deepEqual(bad.components, {
    nameEqual: false,
    nodesEqual: false,
    connectionsEqual: true,
    settingsEqual: false,
  });
  assert.doesNotMatch(JSON.stringify(bad), /SYNTHETIC_PRIVATE|123|token|sha256|hash|parameters/);
});

test('baseline diagnostic retains existing metadata and false-default graph semantics', () => {
  const f = fixture(),
    b = f.plan.baseline.find((v) => v.key === 'WF-00');
  const dto = structuredClone(f.workflows.get(b.id));
  dto.updatedAt = 'SYNTHETIC_IGNORED_METADATA';
  dto.meta = { private: 'SYNTHETIC_PRIVATE_METADATA' };
  for (const n of dto.nodes)
    for (const k of ['retryOnFail', 'continueOnFail', 'executeOnce', 'alwaysOutputData'])
      if (!Object.hasOwn(n, k)) n[k] = false;
  assert.deepEqual(
    runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId).failedChecks,
    [],
  );
  dto.nodes[0].unrecognizedPrivateField = 'SYNTHETIC_PRIVATE_NODE_FIELD';
  const bad = runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId);
  assert.ok(bad.failedChecks.includes('node_shape'));
  assert.doesNotMatch(JSON.stringify(bad), /SYNTHETIC_|unrecognizedPrivateField/);
});

test('baseline diagnostic isolates all ownership/publication/tag/pin gates', () => {
  const f = fixture(),
    b = f.plan.baseline.find((v) => v.key === 'WF-00');
  const dto = structuredClone(f.workflows.get(b.id));
  Object.assign(dto, {
    id: 'wrong-id',
    versionId: null,
    isArchived: true,
    active: true,
    activeVersionId: 'wrong-active',
    shared: [],
    tags: [],
    pinData: { private: 'SYNTHETIC_PRIVATE_PIN' },
  });
  const bad = runtimeControl.diagnoseFoundationRuntimeBaseline(dto, b, f.plan.projectId);
  assert.deepEqual(bad.failedChecks, [
    'workflow_id',
    'archive_state',
    'activation_state',
    'active_version',
    'version_shape',
    'version_mismatch',
    'owner_project',
    'tags_mismatch',
    'pinned_data',
  ]);
  assert.doesNotMatch(JSON.stringify(bad), /wrong-id|wrong-active|SYNTHETIC_PRIVATE_PIN/);
});

test('production baseline guard records diagnostic and still refuses every mutation on graph drift', async () => {
  const f = fixture();
  const b = f.plan.baseline.find((v) => v.key === 'WF-00');
  f.workflows.get(b.id).settings.executionTimeout = 123;
  const r = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(r.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  assert.deepEqual(runtimeControl.foundationRuntimeGuardDiagnostic(f.journal).failedChecks, [
    'graph_settings',
  ]);
});

test('ordinary WF00 guards require the actual native pin while keeping every other workflow raw', async () => {
  const f = fixture(),
    baseline = f.plan.baseline.find((v) => v.key === 'WF-00'),
    dto = f.workflows.get(baseline.id);
  assert.equal(
    checkpointDiagnostics.foundationRuntimeObservedGraphHash(dto, baseline),
    runtimeGraphHash(baseline.body),
  );
  assert.deepEqual(
    checkpointDiagnostics.diagnoseFoundationRuntimeBaseline(dto, baseline, f.plan.projectId).failedChecks,
    [],
  );
  for (const mutate of [
    (v) => delete v.settings.binaryMode,
    (v) => (v.settings.binaryMode = 'combined'),
    (v) => (v.settings.binaryMode = 'SYNTHETIC_PRIVATE_MODE'),
    (v) => (v.settings.credentialResolverId = ''),
    (v) => (v.settings.syntheticUnknownSetting = true),
    (v) => v.settings.executionTimeout++,
  ]) {
    const changed = structuredClone(dto);
    mutate(changed);
    assert.ok(
      checkpointDiagnostics.diagnoseFoundationRuntimeBaseline(changed, baseline, f.plan.projectId)
        .failedChecks.length,
    );
    const other = fixture();
    mutate(other.workflows.get(baseline.id));
    assert.equal((await runFoundationRuntimeSetup(other.plan, other.ports)).status, 'blocked');
    assert.equal(
      other.calls.some((v) => v.method !== 'GET'),
      false,
    );
  }
  const other = f.plan.baseline.find((v) => v.key === 'WF-10');
  assert.throws(() =>
    checkpointDiagnostics.foundationRuntimeNativeReadonlyPin({
      ...other,
      nativeReadonlySettings: baseline.nativeReadonlySettings,
    }),
  );
  const otherDto = structuredClone(f.workflows.get(other.id));
  otherDto.settings.binaryMode = 'separate';
  assert.notEqual(
    checkpointDiagnostics.foundationRuntimeObservedGraphHash(otherDto, other),
    runtimeGraphHash(other.body),
  );
});

function fixture({ durableAppend, fault, sharedLimit = 512, machineUpdatedAt, activeWindowId } = {}) {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const transport = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/transport.dev.json', import.meta.url)),
  );
  const records = Object.keys(bindings.workflowRefs).map((k) =>
    JSON.parse(readFileSync(new URL('../../n8n/workflows/' + k + '.json', import.meta.url))),
  );
  const setup = {
    version: 1,
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
    sourceCommitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticRuntimeOnly',
    audience: 'https://everyone-market-researcher-synthetic-runtime-only.vercel.app',
    environment: 'preview',
    readyState: 'READY',
    protection: 'all_except_custom_domains',
    protectionVerified: true,
    protectionTransportVerified: true,
    sqlAudienceBindingVerified: true,
  };
  const plan = createFoundationRuntimePlan({ bindings, transport, records, setup, activeWindowId });
  let serial = 0,
    attempts = 0;
  const calls = [],
    workflows = new Map(
      plan.baseline.map((b) => [
        b.id,
        {
          id: b.id,
          versionId: b.versionId,
          active: false,
          activeVersionId: null,
          isArchived: false,
          shared: [{ projectId: plan.projectId, role: 'workflow:owner' }],
          ...structuredClone(b.body),
          settings: { ...structuredClone(b.body.settings), ...(b.nativeReadonlySettings ?? {}) },
          tags: structuredClone(b.tags),
          pinData: {},
          activeVersion: null,
        },
      ]),
    );
  const credential = {
    ...plan.machine,
    updatedAt: machineUpdatedAt ?? plan.machine.createdAt,
    isManaged: false,
    isGlobal: false,
    isResolvable: false,
    resolverId: null,
  };
  const credentialData = {
    json: '{"headers":{"Authorization":"Bearer SYNTHETIC_MACHINE_ONLY_12345678901234567890"}}',
    allowedHttpRequestDomains: 'domains',
    allowedDomains: new URL(plan.oldAudience).hostname,
  };
  const journal = createFoundationRuntimeJournal(plan, [], durableAppend ?? (() => {}));
  const send = async (method, path, body) => {
    calls.push({ method, path, body: structuredClone(body) });
    if (fault) await fault({ method, path, body, calls, workflows, credential });
    if (method === 'GET' && path.endsWith('/schema/httpCustomAuth'))
      return {
        status: 200,
        body: { properties: { json: {}, allowedDomains: {}, allowedHttpRequestDomains: {} } },
      };
    if (path === '/api/v1/credentials/' + plan.machine.id) {
      if (method === 'PATCH') {
        assert.equal(body.isPartialData, true);
        assert.equal(Object.hasOwn(body.data, 'json'), true);
        Object.assign(credentialData, body.data);
        credential.updatedAt = new Date(Date.UTC(2026, 9, 20, 0, 0, ++serial)).toISOString();
      }
      return { status: 200, body: structuredClone(credential) };
    }
    const m = /^\/api\/v1\/workflows\/([^/?]+)(.*)$/.exec(path);
    const w = workflows.get(m?.[1]);
    if (!w) throw Error('SYNTHETIC_UNOWNED_ROUTE');
    if (method === 'GET') return { status: 200, body: structuredClone(w) };
    if (method === 'PUT') {
      assert.equal(m[2], '?publishIfActive=false');
      // n8n2.43.5 WorkflowService.update creates a version for structure only;
      // name/settings writes preserve the current native version.
      const structureChanged =
        !isDeepStrictEqual(w.nodes, body.nodes) || !isDeepStrictEqual(w.connections, body.connections);
      const previousVersion = w.versionId;
      if (body.settings.errorWorkflow && body.settings.errorWorkflow !== 'DEFAULT') {
        const target = workflows.get(body.settings.errorWorkflow);
        assert.equal(Boolean(target?.activeVersionId), true, 'native write requires published error target');
        assert.equal(
          target.activeVersion.nodes.some(
            (n) => n.type === 'n8n-nodes-base.errorTrigger' && n.disabled !== true,
          ),
          true,
        );
      }
      const settings = { ...w.settings, ...structuredClone(body.settings) };
      if (settings.errorWorkflow === 'DEFAULT') delete settings.errorWorkflow;
      Object.assign(w, structuredClone(body), {
        settings,
        versionId: structureChanged ? 'synthetic-version-' + ++serial : previousVersion,
      });
    } else if (method === 'POST' && m[2] === '/publish') {
      assert.equal(body.versionId, w.versionId);
      assert.equal(
        w.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger' && n.disabled !== true),
        false,
      );
      for (const n of w.nodes.filter(
        (n) => n.type === 'n8n-nodes-base.executeWorkflow' && n.disabled !== true,
      )) {
        const targetId =
          typeof n.parameters.workflowId === 'string'
            ? n.parameters.workflowId
            : n.parameters.workflowId?.value;
        assert.equal(
          Boolean(workflows.get(targetId)?.activeVersionId),
          true,
          'native production dependency must already be published',
        );
      }
      w.active = true;
      w.activeVersionId = w.versionId;
      w.activeVersion = {
        workflowId: w.id,
        versionId: w.versionId,
        nodes: structuredClone(w.nodes),
        connections: structuredClone(w.connections),
      };
    } else if (method === 'POST' && m[2] === '/unpublish') {
      w.active = false;
      w.activeVersionId = null;
      w.activeVersion = null;
    } else throw Error('SYNTHETIC_ROUTE_DENIED');
    return { status: 200, body: structuredClone(w) };
  };
  return {
    plan,
    journal,
    workflows,
    credentialData,
    calls,
    ports: {
      journal,
      send,
      prepareMachinePatch({ audience, restore }) {
        return prepareFoundationRuntimeMachinePatch({
          audience,
          restore,
          machineToken: 'SYNTHETIC_MACHINE_ONLY_12345678901234567890',
          ...(restore ? {} : { protectionBypass: 'SYNTHETIC_NEW_PROTECTION_ONLY_12345' }),
        });
      },
      admitManagementAttempt() {
        if (++attempts > sharedLimit) throw Error('SHARED_MANAGEMENT_LIMIT');
      },
    },
  };
}

test('native settings-only save retains its version and structural saves rotate before exact readback', async () => {
  const f = fixture();
  const result = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(result.status, 'runtime_setup_verified');
  const intents = f.journal.rows.filter(
    (r) => r.event === 'intent' && r.action === 'save' && r.key === 'SUB-NOTIFY',
  );
  assert.equal(intents.length, 2);
  const receipt = (intent) =>
    f.journal.rows.find((r) => r.event === 'verified' && r.sequence === intent.sequence);
  assert.notEqual(receipt(intents[0]).after.versionId, intents[0].before.versionId);
  assert.equal(receipt(intents[1]).after.versionId, intents[1].before.versionId);
  assert.equal(receipt(intents[1]).after.graphHash, intents[1].target.graphHash);
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.ports)).status,
    'exact_staging_restored_unpublished',
  );
});

test('native version assertions reject unchanged structural versions and unexpected settings-only versions', async () => {
  for (const mode of ['structure_keeps_version', 'settings_rotates_version']) {
    const f = fixture(),
      send = f.ports.send;
    let altered = false;
    f.ports.send = async (method, path, body) => {
      const id = /^\/api\/v1\/workflows\/([^/?]+)/.exec(path)?.[1],
        before = f.workflows.get(id);
      const previous = before ? structuredClone(before) : null;
      const response = await send(method, path, body);
      if (!altered && method === 'PUT' && id === 'tiEhU3dXrMifOnTL') {
        const structural =
          !isDeepStrictEqual(previous.nodes, body.nodes) ||
          !isDeepStrictEqual(previous.connections, body.connections);
        if (
          (mode === 'structure_keeps_version' && structural) ||
          (mode === 'settings_rotates_version' && !structural)
        ) {
          altered = true;
          response.body.versionId = structural ? previous.versionId : 'synthetic-unexpected-version';
        }
      }
      return response;
    };
    const result = await runFoundationRuntimeSetup(f.plan, f.ports);
    assert.equal(altered, true, mode);
    assert.equal(result.status, 'reconciliation_required', mode);
    assert.equal(result.pendingMutation, true, mode);
    assert.equal(f.calls.at(-1).method, 'PUT', mode);
    const writes = f.calls.filter((v) => v.method === 'PUT').length;
    assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'reconciliation_required');
    assert.equal(
      f.calls.filter((v) => v.method === 'PUT').length,
      writes,
      'an uncertain write is not replayed',
    );
  }
});

test('native settings-only same-version acceptance still requires exact fresh settings readback', async () => {
  const f = fixture(),
    send = f.ports.send;
  let awaitingReadback = false;
  f.ports.send = async (method, path, body) => {
    const response = await send(method, path, body);
    if (
      method === 'PUT' &&
      path.includes('/tiEhU3dXrMifOnTL?') &&
      body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv'
    )
      awaitingReadback = true;
    else if (awaitingReadback && method === 'GET' && path.includes('/tiEhU3dXrMifOnTL?')) {
      response.body.settings.executionTimeout = 1;
      awaitingReadback = false;
    }
    return response;
  };
  const result = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.pendingMutation, true);
  assert.equal(f.calls.at(-1).method, 'GET');
  const pending = foundationRuntimeState(f.plan, f.journal).pending;
  assert.equal(pending.action, 'save');
  assert.equal(pending.key, 'SUB-NOTIFY');
  assert.equal(pending.target.versionId, pending.before.versionId);
});

async function pendingSettingsRestorationFixture() {
  const f = fixture({ activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e' }),
    send = f.ports.send;
  let lost = false;
  f.ports.send = async (method, path, body) => {
    const r = await send(method, path, body);
    if (
      !lost &&
      method === 'PUT' &&
      path.includes('/tiEhU3dXrMifOnTL?') &&
      body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv'
    ) {
      lost = true;
      throw Error('SYNTHETIC_UNKNOWN_SAVE_ACK');
    }
    return r;
  };
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'reconciliation_required');
  // Model the original helper's reused25-read proof and null target version.
  // This is an isolated journal reconstruction, never an actual prefix rewrite.
  const rows = f.journal.rows
    .filter((r) => r.event !== 'request' || r.number > 25)
    .map((r) => {
      const row = structuredClone(r);
      if (row.event === 'request') row.number -= 25;
      if (row.event === 'intent' && row.sequence === 7) row.target.versionId = null;
      return row;
    });
  const journal = createFoundationRuntimeJournal(f.plan, rows, () => {});
  return {
    ...f,
    originalRows: structuredClone(rows),
    recoveryJournal: journal,
    recoveryPorts: { ...f.ports, journal },
  };
}

test('restore-only settings adoption performs its own exact GET without replay or original acknowledgement claims', async () => {
  const f = await pendingSettingsRestorationFixture(),
    before = JSON.stringify(f.originalRows),
    count = f.calls.length;
  const result = await runtimeControl.adoptFoundationRuntimeSettingsSaveForRestoration(
    f.plan,
    f.recoveryPorts,
  );
  assert.equal(result.status, 'settings_save_readback_verified_original_ack_unknown');
  assert.equal(result.restoreOnly, true);
  assert.equal(result.originalAcknowledgementVerified, false);
  assert.equal(result.mutationReplayAllowed, false);
  assert.equal(f.calls.length, count + 1);
  assert.equal(f.calls.at(-1).method, 'GET');
  assert.equal(f.calls.at(-1).path, '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true');
  assert.equal(foundationRuntimeState(f.plan, f.recoveryJournal).pending, null);
  assert.equal(JSON.stringify(f.originalRows), before);
  const after = f.calls.length;
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.recoveryPorts)).status, 'blocked');
  assert.equal(
    (
      await saveFoundationRuntimeCase(
        f.plan,
        materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo'),
        f.recoveryPorts,
      )
    ).status,
    'blocked',
  );
  assert.throws(() => runtimeControl.createFoundationRuntimeBinding(f.plan, 'SUB-NOTIFY', f.recoveryPorts));
  assert.equal(f.calls.length, after);
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.recoveryPorts)).status,
    'exact_staging_restored_unpublished',
  );
  assert.equal(foundationRuntimeState(f.plan, f.recoveryJournal).machineRebound, false);
  assert.equal(JSON.stringify(f.originalRows), before);
  assert.deepEqual(f.recoveryJournal.rows.slice(0, f.originalRows.length), f.originalRows);
});

test('restore-only settings adoption refuses changed target identity, graph, version, publication and custody before confirmation', async () => {
  for (const field of ['version', 'settings', 'published', 'project', 'tags', 'pinData']) {
    const f = await pendingSettingsRestorationFixture(),
      send = f.recoveryPorts.send;
    f.recoveryPorts.send = async (...args) => {
      const r = await send(...args);
      if (field === 'version') r.body.versionId = 'synthetic-foreign-version';
      if (field === 'settings') r.body.settings.executionTimeout = 1;
      if (field === 'published') {
        r.body.active = true;
        r.body.activeVersionId = r.body.versionId;
      }
      if (field === 'project')
        r.body.shared = [{ projectId: 'synthetic-other-project', role: 'workflow:owner' }];
      if (field === 'tags') r.body.tags = [];
      if (field === 'pinData') r.body.pinData = { synthetic: true };
      return r;
    };
    const before = f.recoveryJournal.rows.length,
      count = f.calls.length;
    const result = await runtimeControl.adoptFoundationRuntimeSettingsSaveForRestoration(
      f.plan,
      f.recoveryPorts,
    );
    assert.equal(result.status, 'settings_save_readback_blocked', field);
    assert.equal(f.calls.length, count + 1, field);
    assert.equal(f.recoveryJournal.rows.length, before + 1, 'only own GET intent is added');
    assert.equal(foundationRuntimeState(f.plan, f.recoveryJournal).pending.sequence, 7);
    assert.equal(result.mutationReplayAllowed, false);
  }
});

test('restore-only settings adoption accepts only the exact old pending save and respects durable admission vetoes', async () => {
  for (const fault of ['target', 'version', 'last-request', 'extra-request', 'admission', 'confirmation']) {
    const f = await pendingSettingsRestorationFixture(),
      rows = structuredClone(f.originalRows),
      count = f.calls.length;
    if (fault === 'target')
      rows.find((r) => r.event === 'intent' && r.sequence === 7).target.graphHash = 'a'.repeat(64);
    if (fault === 'version') {
      const pending = rows.find((r) => r.event === 'intent' && r.sequence === 7);
      pending.target.versionId = pending.before.versionId;
    }
    if (fault === 'last-request')
      Object.assign(rows.at(-1), {
        method: 'GET',
        path: '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true',
      });
    if (fault === 'extra-request')
      rows.push({
        event: 'request',
        number: 23,
        method: 'GET',
        path: '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true',
      });
    const journal = createFoundationRuntimeJournal(f.plan, rows, (row) => {
      if (fault === 'confirmation' && row.event === 'verified') throw Error('SYNTHETIC_PRIVATE_DURABLE_VETO');
    });
    const ports = { ...f.recoveryPorts, journal };
    if (fault === 'admission')
      ports.admitManagementAttempt = () => {
        throw Error('SYNTHETIC_PRIVATE_ADMISSION_VETO');
      };
    const result = await runtimeControl.adoptFoundationRuntimeSettingsSaveForRestoration(f.plan, ports);
    assert.equal(result.status, 'settings_save_readback_blocked', fault);
    assert.equal(f.calls.length, count + (fault === 'confirmation' ? 1 : 0), fault);
    assert.equal(foundationRuntimeState(f.plan, journal).pending.sequence, 7, fault);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|VETO/);
  }
});

test('finite setup uses exact recorded identities, native error validation and same-token partial domain PATCH', async () => {
  const f = fixture(),
    before = f.credentialData.json;
  const r = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(r.status, 'runtime_setup_verified');
  assert.equal(r.requestCount, 135);
  assert.equal(r.currentlyPublished.length, 7);
  assert.equal(
    JSON.parse(f.credentialData.json).headers.Authorization,
    JSON.parse(before).headers.Authorization,
  );
  assert.equal(
    JSON.parse(f.credentialData.json).headers['x-vercel-protection-bypass'],
    'SYNTHETIC_NEW_PROTECTION_ONLY_12345',
  );
  assert.equal(JSON.stringify(f.journal.rows).includes('SYNTHETIC_MACHINE_ONLY'), false);
  assert.equal(JSON.stringify(f.journal.rows).includes('SYNTHETIC_NEW_PROTECTION_ONLY'), false);
  assert.equal(f.credentialData.allowedDomains, new URL(f.plan.setup.audience).hostname);
  assert.equal(
    f.calls.some((c) =>
      c.path.endsWith('/' + f.plan.baseline.find((b) => b.key === 'WF-00').id + '/publish'),
    ),
    false,
  );
  assert.equal(
    f.calls.some((c) => /\/credentials$/.test(c.path)),
    false,
  );
  const notifyId = f.plan.baseline.find((b) => b.key === 'SUB-NOTIFY').id;
  const clear = f.calls.findIndex((c) => c.path === '/api/v1/workflows/' + notifyId + '/unpublish');
  const link = f.calls.findIndex(
    (c) =>
      c.method === 'PUT' &&
      c.path.startsWith('/api/v1/workflows/' + notifyId + '?') &&
      c.body.settings.errorWorkflow !== 'DEFAULT',
  );
  assert.equal(clear < link, true);
  assert.equal(r.executionsStarted, 0);
});

test('qualified current Machine metadata can differ from creation while a fresh version check precedes the same-token rebind', async () => {
  const baseline = '2026-10-19T00:25:21.670Z';
  const f = fixture({ machineUpdatedAt: baseline });
  const before = f.credentialData.json;
  const result = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(result.status, 'runtime_setup_verified');
  const patch = f.calls.findIndex((c) => c.method === 'PATCH');
  assert.equal(
    f.calls.slice(0, patch).filter((c) => c.path === '/api/v1/credentials/EmrM03Machine19').length,
    2,
  );
  assert.equal(f.journal.rows.find((r) => r.event === 'machine_observed').updatedAt, baseline);
  assert.equal(
    JSON.parse(f.credentialData.json).headers.Authorization,
    JSON.parse(before).headers.Authorization,
  );
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.ports)).status,
    'exact_staging_restored_unpublished',
  );
  assert.deepEqual(f.credentialData, {
    json: before,
    allowedHttpRequestDomains: 'domains',
    allowedDomains: new URL(f.plan.oldAudience).hostname,
  });
});

test('a changed Machine version at the immediate fresh check blocks before intent, PATCH or workflow writes', async () => {
  let observations = 0;
  const f = fixture({
    fault({ method, path, credential }) {
      if (method === 'GET' && path === '/api/v1/credentials/EmrM03Machine19' && ++observations === 2)
        credential.updatedAt = '2026-10-19T00:25:21.670Z';
    },
  });
  const before = structuredClone(f.credentialData);
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  assert.equal(observations, 2);
  assert.equal(
    f.calls.some((c) => c.method !== 'GET'),
    false,
  );
  assert.equal(
    f.journal.rows.some((r) => r.event === 'intent'),
    false,
  );
  assert.deepEqual(f.credentialData, before);
});

test('Machine version metadata rejects Date.parse-valid private comments before journaling or mutation', async () => {
  const stamp = 'October 19, 2026 00:25:22 GMT (SYNTHETIC_PRIVATE_COMMENT)';
  assert.equal(Number.isFinite(Date.parse(stamp)), true);
  const f = fixture({ machineUpdatedAt: stamp });
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  assert.equal(
    f.journal.rows.some((r) => r.event === 'machine_observed'),
    false,
  );
  assert.equal(
    f.calls.some((c) => c.method !== 'GET'),
    false,
  );
  assert.doesNotMatch(JSON.stringify(f.journal.rows), /SYNTHETIC_PRIVATE/);
});

test('Machine version metadata accepts bounded ISO dates with milliseconds, offsets or no milliseconds without canonicalizing them', async () => {
  for (const stamp of ['2026-10-19T00:25:21.670Z', '2026-10-19T00:25:22+00:00', '2026-10-19T00:25:22Z']) {
    const f = fixture({ machineUpdatedAt: stamp });
    assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
    assert.equal(f.journal.rows.find((r) => r.event === 'machine_observed').updatedAt, stamp);
  }
});

test('Machine observations still require the qualified creation identity, non-secret shape and security flags', async () => {
  for (const change of [
    { id: 'foreign' },
    { name: 'foreign' },
    { type: 'httpHeaderAuth' },
    { createdAt: '2026-10-19T00:25:21.670Z' },
    { updatedAt: 'SYNTHETIC_PRIVATE_INVALID' },
    { data: { secret: 'SYNTHETIC_PRIVATE_VALUE' } },
    { isManaged: true },
    { isGlobal: true },
    { isResolvable: true },
    { resolverId: 'foreign' },
  ]) {
    const f = fixture({
      fault({ method, path, credential }) {
        if (method === 'GET' && path === '/api/v1/credentials/EmrM03Machine19')
          Object.assign(credential, change);
      },
    });
    const result = await runFoundationRuntimeSetup(f.plan, f.ports);
    assert.equal(result.status, 'blocked');
    assert.equal(
      f.calls.some((c) => c.method !== 'GET'),
      false,
    );
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|foreign/);
  }
});

test('all actual publications are removed, all25 exact baseline bodies restored and DEFAULT clears merged links', async () => {
  const f = fixture();
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
  const draft = materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo');
  assert.equal((await saveFoundationRuntimeCase(f.plan, draft, f.ports)).status, 'case_draft_verified');
  const r = await restoreFoundationRuntime(f.plan, f.ports);
  assert.equal(r.status, 'exact_staging_restored_unpublished');
  assert.equal(r.requestCount, 135 + 3 + 99 + 25);
  assert.equal(runtimeControl.assertFoundationRuntimeRestorationAudit(r, { plan: f.plan }), r);
  assert.equal(r.verifiedWorkflows, 25);
  assert.throws(() => runtimeControl.assertFoundationRuntimeRestorationAudit({ ...r }, { plan: f.plan }));
  assert.throws(() => runtimeControl.assertFoundationRuntimeRestorationAudit(r, { plan: fixture().plan }));
  assert.equal(r.currentlyPublished.length, 0);
  assert.equal(f.credentialData.allowedDomains, new URL(f.plan.oldAudience).hostname);
  assert.deepEqual(JSON.parse(f.credentialData.json), {
    headers: { Authorization: 'Bearer SYNTHETIC_MACHINE_ONLY_12345678901234567890' },
  });
  for (const b of f.plan.baseline) {
    const w = f.workflows.get(b.id);
    assert.equal(w.active, false);
    assert.equal(w.activeVersionId, null);
    assert.equal(checkpointDiagnostics.foundationRuntimeObservedGraphHash(w, b), runtimeGraphHash(b.body));
    if (b.nativeReadonlySettings)
      assert.deepEqual(
        checkpointDiagnostics.foundationNativeReadonlySettings(w.settings),
        b.nativeReadonlySettings,
      );
    assert.equal(Object.hasOwn(w.settings, 'errorWorkflow'), false);
    assert.equal(w.settings.availableInMCP, false);
  }
  assert.equal(foundationRuntimeState(f.plan, f.journal).restoreComplete, true);
});

test('different version or content stops before a case or restoration can overwrite an editor', async () => {
  const f = fixture();
  await runFoundationRuntimeSetup(f.plan, f.ports);
  const target = f.workflows.get(f.plan.baseline.find((b) => b.key === 'WF-00').id);
  target.versionId = 'foreign-editor-version';
  const writes = f.calls.filter((c) => c.method !== 'GET').length;
  const r = await saveFoundationRuntimeCase(
    f.plan,
    materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo'),
    f.ports,
  );
  assert.equal(r.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, writes);
  assert.equal(target.versionId, 'foreign-editor-version');
});

test('lost save acknowledgement leaves durable intent, never repeats PUT and read-only reconciliation cannot adopt it', async () => {
  const f = fixture();
  const realSend = f.ports.send;
  let lost = false;
  f.ports.send = async (...args) => {
    const r = await realSend(...args);
    if (!lost && args[0] === 'PUT') {
      lost = true;
      throw Error('SYNTHETIC_PRIVATE_ERROR_DO_NOT_EMIT');
    }
    return r;
  };
  const first = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(first.status, 'reconciliation_required');
  assert.equal(first.pendingMutation, true);
  const writes = f.calls.filter((c) => c.method !== 'GET').length;
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'reconciliation_required');
  assert.equal((await restoreFoundationRuntime(f.plan, f.ports)).status, 'reconciliation_required');
  const rec = await reconcileFoundationRuntimeReadOnly(f.plan, f.ports);
  assert.equal(rec.status, 'matching_target_unattributed');
  assert.equal(rec.mutationReplayAllowed, false);
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, writes);
  assert.equal(JSON.stringify(first).includes('PRIVATE'), false);
});

test('ambiguous Machine PATCH cannot be proven by metadata and is never silently replayed', async () => {
  const f = fixture();
  const send = f.ports.send;
  f.ports.send = async (...args) => {
    const r = await send(...args);
    if (args[0] === 'PATCH') throw Error('SYNTHETIC_PRIVATE_NATIVE');
    return r;
  };
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'reconciliation_required');
  assert.equal(
    (await reconcileFoundationRuntimeReadOnly(f.plan, f.ports)).status,
    'metadata_changed_domain_unverified',
  );
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal((await restoreFoundationRuntime(f.plan, f.ports)).status, 'reconciliation_required');
});

test('durable intent failure and shared management refusal prevent their corresponding mutation', async () => {
  const f = fixture({
    durableAppend: (r) => {
      if (r.event === 'intent') throw Error('SYNTHETIC_FLUSH_FAILED');
    },
  });
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  assert.equal(
    f.calls.some((c) => c.method !== 'GET'),
    false,
  );
  const limited = fixture({ sharedLimit: 10 });
  assert.equal((await runFoundationRuntimeSetup(limited.plan, limited.ports)).status, 'blocked');
  assert.equal(limited.calls.length, 10);
  assert.equal(
    limited.calls.some((c) => c.method !== 'GET'),
    false,
  );
});

test('altered arbitrary case/code, unowned routes and publication of WF00/WF99 are rejected', async () => {
  const f = fixture();
  const d = structuredClone(materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo'));
  d.body.nodes[0].parameters = { jsCode: 'arbitrary()' };
  assert.equal((await saveFoundationRuntimeCase(f.plan, d, f.ports)).status, 'blocked');
  for (const k of ['WF-00', 'WF-99'])
    assert.equal(
      foundationRuntimeRequestAllowed(
        f.plan,
        'POST',
        '/api/v1/workflows/' + f.plan.baseline.find((b) => b.key === k).id + '/publish',
        { versionId: 'v1' },
      ),
      false,
    );
  assert.equal(foundationRuntimeRequestAllowed(f.plan, 'GET', '/api/v1/variables', null), false);
  assert.equal(
    foundationRuntimeRequestAllowed(f.plan, 'PATCH', '/api/v1/credentials/shared', f.plan.machinePatch),
    false,
  );
  assert.equal(
    foundationRuntimeRequestAllowed(
      f.plan,
      'PUT',
      '/api/v1/workflows/' + d.id + '?publishIfActive=false',
      d.body,
    ),
    false,
  );
});

test('partial setup cleanup restores only verified owned work and does not modify an untouched definition', async () => {
  let stop = false;
  const f = fixture({
    fault: ({ method, path }) => {
      if (
        !stop &&
        method === 'GET' &&
        path.includes('/api/v1/workflows/') &&
        path.includes('S9NHRkKFUIiXX2wv')
      ) {
        stop = true;
        throw Error('SYNTHETIC_READ_STOP');
      }
    },
  });
  const r = await runFoundationRuntimeSetup(f.plan, f.ports);
  assert.equal(r.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  const restored = await restoreFoundationRuntime(f.plan, f.ports);
  assert.equal(restored.status, 'exact_staging_restored_unpublished');
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('interrupted bootstrap unpublishes its actual dependency and restores only definitions that changed', async () => {
  let stopped = false;
  const f = fixture({
    fault: ({ method, path, workflows }) => {
      if (
        !stopped &&
        method === 'GET' &&
        path.includes('/S9NHRkKFUIiXX2wv?') &&
        workflows.get('tiEhU3dXrMifOnTL').active === true
      ) {
        stopped = true;
        throw Error('SYNTHETIC_BEFORE_NEXT_INTENT');
      }
    },
  });
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  assert.deepEqual(foundationRuntimeState(f.plan, f.journal).publishedHistory, ['SUB-NOTIFY']);
  const untouched = f.workflows.get(f.plan.baseline.find((b) => b.key === 'WF-10').id).versionId;
  const r = await restoreFoundationRuntime(f.plan, f.ports);
  assert.equal(r.status, 'exact_staging_restored_unpublished');
  assert.equal(r.currentlyPublished.length, 0);
  assert.equal(f.workflows.get(f.plan.baseline.find((b) => b.key === 'WF-10').id).versionId, untouched);
  assert.equal(f.credentialData.allowedDomains, new URL(f.plan.oldAudience).hostname);
});

test('native false defaults are equivalent, but enabling a behavior or an unknown node property is drift', async () => {
  const f = fixture();
  for (const w of f.workflows.values())
    for (const n of w.nodes) if (n.disabled === undefined) n.disabled = false;
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
  const w = f.workflows.get(f.plan.baseline.find((b) => b.key === 'WF-00').id);
  w.nodes[0].retryOnFail = true;
  const writes = f.calls.filter((c) => c.method !== 'GET').length;
  assert.equal(
    (
      await saveFoundationRuntimeCase(
        f.plan,
        materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo'),
        f.ports,
      )
    ).status,
    'blocked',
  );
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, writes);
  assert.throws(() =>
    createFoundationRuntimeJournal(f.plan, [
      { event: 'header', version: 1, planHash: f.plan.planHash },
      { event: 'request', number: 1, method: 'GET', path: '/api/v1/variables' },
    ]),
  );
});

test('async durable intent or admission is rejected before any corresponding network mutation', async () => {
  const f = fixture({
    durableAppend: (r) => (r.event === 'intent' ? Promise.reject(Error('SYNTHETIC_LATE_FLUSH')) : undefined),
  });
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    f.calls.some((c) => c.method !== 'GET'),
    false,
  );
  const b = fixture();
  b.ports.admitManagementAttempt = async () => {};
  assert.equal((await runFoundationRuntimeSetup(b.plan, b.ports)).status, 'blocked');
  assert.equal(b.calls.length, 0);
});

test('same-journal operations cannot race a blocked GET or reopen terminal restoration', async () => {
  let release, entered;
  const waiting = new Promise((resolve) => {
    entered = resolve;
  });
  const pause = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    fault: async ({ method, path }) => {
      if (method === 'GET' && path.endsWith('/schema/httpCustomAuth')) {
        entered();
        await pause;
      }
    },
  });
  const setup = runFoundationRuntimeSetup(f.plan, f.ports);
  await waiting;
  assert.equal((await restoreFoundationRuntime(f.plan, f.ports)).status, 'operation_in_progress');
  assert.equal((await reconcileFoundationRuntimeReadOnly(f.plan, f.ports)).status, 'operation_in_progress');
  release();
  assert.equal((await setup).status, 'runtime_setup_verified');
  assert.equal(foundationRuntimeState(f.plan, f.journal).restoreComplete, false);
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.ports)).status,
    'exact_staging_restored_unpublished',
  );
  const requests = f.calls.length;
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'reconciliation_required');
  assert.equal(f.calls.length, requests);
  assert.throws(() =>
    f.journal.append({
      event: 'intent',
      sequence: f.journal.rows.filter((r) => r.event === 'intent').length + 1,
      action: 'machine_rebind',
      key: 'Machine',
      before: foundationRuntimeState(f.plan, f.journal).machineUpdatedAt,
      target: 'runtime',
    }),
  );
});

test('only an exact factory-and-GET-verified case receipt carries the execution-control brand', async () => {
  const f = fixture();
  await runFoundationRuntimeSetup(f.plan, f.ports);
  const draft = materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo');
  const receipt = await saveFoundationRuntimeCase(f.plan, draft, f.ports);
  assert.equal(assertFoundationRuntimeCaseReceipt(receipt), receipt);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(receipt.bodyHash, draft.bodyHash);
  assert.throws(() => assertFoundationRuntimeCaseReceipt(structuredClone(receipt)));
  assert.throws(() =>
    assertFoundationRuntimeCaseReceipt(Object.freeze({ ...receipt, versionId: 'another-version' })),
  );
});

test('a Machine changed after its verified runtime rebind is not overwritten during restoration', async () => {
  const f = fixture();
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
  const original = f.ports.send;
  f.ports.send = async (...args) => {
    const r = await original(...args);
    if (args[0] === 'GET' && args[1] === '/api/v1/credentials/' + f.plan.machine.id)
      r.body.updatedAt = '2026-10-20T00:00:00.000Z';
    return r;
  };
  const patches = f.calls.filter((c) => c.method === 'PATCH').length;
  assert.equal((await restoreFoundationRuntime(f.plan, f.ports)).status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, patches);
  assert.equal(foundationRuntimeState(f.plan, f.journal).machineRebound, true);
  assert.equal(
    f.journal.rows.some((r) => r.event === 'intent' && r.action === 'machine_restore'),
    false,
  );
});

test('journal requires an explicit durable port and exposed row snapshots cannot forge confirmation', () => {
  const f = fixture();
  assert.throws(() => createFoundationRuntimeJournal(f.plan, []));
  const rows = f.journal.rows;
  assert.equal(Object.isFrozen(rows), true);
  assert.equal(Object.isFrozen(rows[0]), true);
  assert.throws(() => rows.push({ event: 'setup_complete' }));
  assert.equal(f.journal.rows.length, 1);
});

test('private Machine preparation cannot inject cookies or an unbranded native JSON body', async () => {
  const f = fixture();
  f.ports.prepareMachinePatch = () => ({
    isPartialData: true,
    data: { ...f.plan.machinePatch.data, json: '{"headers":{"Cookie":"SYNTHETIC"}}' },
  });
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'blocked');
  assert.equal(
    f.calls.some((c) => c.method === 'PATCH'),
    false,
  );
  assert.equal(
    foundationRuntimeRequestAllowed(
      f.plan,
      'PATCH',
      '/api/v1/credentials/' + f.plan.machine.id,
      f.plan.machinePatch,
    ),
    false,
  );
});

test('never-settling or rejecting async Machine preparation is blocked before writes and releases the operation guard', async () => {
  for (const prepare of [
    () => new Promise(() => {}),
    () => Promise.reject(Error('SYNTHETIC_PRIVATE_PREPARATION_FAILURE')),
  ]) {
    const f = fixture();
    f.ports.prepareMachinePatch = prepare;
    const r = await Promise.race([
      runFoundationRuntimeSetup(f.plan, f.ports),
      new Promise((resolve) => setTimeout(() => resolve({ status: 'still_pending' }), 500)),
    ]);
    assert.equal(r.status, 'blocked');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      f.calls.some((c) => c.method !== 'GET'),
      false,
    );
    assert.equal(foundationRuntimeState(f.plan, f.journal).pending, null);
    assert.equal(
      (await restoreFoundationRuntime(f.plan, f.ports)).status,
      'exact_staging_restored_unpublished',
    );
  }
});

test('restoration also rejects async private preparation without a PATCH or a held operation guard', async () => {
  const f = fixture();
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
  const syncPrepare = f.ports.prepareMachinePatch;
  f.ports.prepareMachinePatch = () => new Promise(() => {});
  const patches = f.calls.filter((c) => c.method === 'PATCH').length;
  const r = await Promise.race([
    restoreFoundationRuntime(f.plan, f.ports),
    new Promise((resolve) => setTimeout(() => resolve({ status: 'still_pending' }), 500)),
  ]);
  assert.equal(r.status, 'blocked');
  assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, patches);
  assert.equal(foundationRuntimeState(f.plan, f.journal).pending, null);
  assert.equal((await reconcileFoundationRuntimeReadOnly(f.plan, f.ports)).status, 'no_pending_mutation');
  f.ports.prepareMachinePatch = syncPrepare;
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.ports)).status,
    'exact_staging_restored_unpublished',
  );
});

test('native binding reuses a private GET observation without another request and rejects copied or stale proof', async () => {
  const f = fixture();
  assert.throws(() => runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-19', f.ports));
  assert.equal((await runFoundationRuntimeSetup(f.plan, f.ports)).status, 'runtime_setup_verified');
  const requests = f.calls.length;
  const binding = runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-19', f.ports);
  assert.equal(f.calls.length, requests);
  assert.equal(runtimeControl.assertFoundationRuntimeBinding(binding), binding);
  assert.equal(binding.versionId, binding.activeVersionId);
  assert.equal(binding.workflowId, f.plan.runtime.find((r) => r.key === 'WF-19').id);
  assert.equal(binding.bodyHash, runtimeGraphHash(binding.body));
  assert.equal(binding.body.settings.saveDataSuccessExecution, 'all');
  assert.equal(Object.isFrozen(binding.body.settings), true);
  assert.throws(() => runtimeControl.assertFoundationRuntimeBinding(structuredClone(binding)));
  const reconstructed = createFoundationRuntimeJournal(f.plan, f.journal.rows, () => {});
  assert.throws(() =>
    runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-19', { ...f.ports, journal: reconstructed }),
  );
  assert.equal(
    (await restoreFoundationRuntime(f.plan, f.ports)).status,
    'exact_staging_restored_unpublished',
  );
  assert.throws(() => runtimeControl.assertFoundationRuntimeBinding(binding));
});

test('case binding requires the same-plan saved receipt and becomes stale after a new case version', async () => {
  const f = fixture();
  await runFoundationRuntimeSetup(f.plan, f.ports);
  const draft = materializeFoundationRuntimeCase(f.plan, 'dispatch.vimeo');
  const receipt = await saveFoundationRuntimeCase(f.plan, draft, f.ports);
  const requests = f.calls.length;
  assert.throws(() => runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-00', f.ports));
  const binding = runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-00', f.ports, {
    caseReceipt: receipt,
  });
  assert.equal(f.calls.length, requests);
  assert.equal(binding.versionId, receipt.versionId);
  assert.equal(binding.activeVersionId, null);
  assert.equal(binding.body.settings.saveManualExecutions, true);
  assert.equal(binding.body.settings.availableInMCP, true);
  assert.equal(binding.bodyHash, runtimeGraphHash(draft.body));
  assert.deepEqual(binding.nativeReadonlySettings, { binaryMode: 'separate' });
  assert.throws(() =>
    runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-00', f.ports, {
      caseReceipt: structuredClone(receipt),
    }),
  );
  await saveFoundationRuntimeCase(
    f.plan,
    materializeFoundationRuntimeCase(f.plan, 'dispatch.unknown'),
    f.ports,
  );
  assert.throws(() => runtimeControl.assertFoundationRuntimeBinding(binding));
  assert.throws(() =>
    runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-00', f.ports, { caseReceipt: receipt }),
  );
});

test('pending writes and published-draft drift cannot reuse a previous binding observation', async () => {
  const f = fixture();
  await runFoundationRuntimeSetup(f.plan, f.ports);
  const binding = runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-19', f.ports);
  const before = foundationRuntimeState(f.plan, f.journal).workflows['WF-19'];
  f.journal.append({
    event: 'intent',
    sequence: f.journal.rows.filter((r) => r.event === 'intent').length + 1,
    action: 'save',
    key: 'WF-19',
    before,
    target: { ...before, versionId: null },
  });
  assert.throws(() => runtimeControl.assertFoundationRuntimeBinding(binding));
  assert.throws(() => runtimeControl.createFoundationRuntimeBinding(f.plan, 'WF-19', f.ports));

  const g = fixture();
  await runFoundationRuntimeSetup(g.plan, g.ports);
  const current = foundationRuntimeState(g.plan, g.journal).workflows['WF-19'];
  const sequence = g.journal.rows.filter((r) => r.event === 'intent').length + 1;
  const target = { ...current, versionId: 'synthetic-unpublished-new-draft' };
  g.journal.append({ event: 'intent', sequence, action: 'save', key: 'WF-19', before: current, target });
  g.journal.append({ event: 'verified', sequence, after: target });
  assert.throws(() => runtimeControl.createFoundationRuntimeBinding(g.plan, 'WF-19', g.ports));
});
