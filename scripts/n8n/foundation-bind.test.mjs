import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  foundationTagNames,
  foundationWorkflowNames,
  nativeFoundationTagName,
  n8nBindingsSchema,
} from '../../packages/shared/src/n8n-bindings.ts';
import {
  parseFoundationPacket,
  provisionTags,
  provisionMachine,
  bindOwnedGraphs,
  createBindingJournal,
  projectSavedGraph,
  inactiveNativeStagingGraph,
  graphBody,
} from './foundation-bind.mjs';
import { buildShell } from './foundation-provision.mjs';
const packet = {
  version: 1,
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  audience: 'https://everyone-market-researcher-synthetic-preview.vercel.app',
  sourceCommitSha: 'a'.repeat(40),
  deploymentId: 'dpl_SYNTHETIC',
  environment: 'preview',
  activationAuthorized: false,
};
const machine = 'm'.repeat(43);
test('delivery packet demands a real fixed immutable Preview contract and never grants activation', () => {
  assert.deepEqual(parseFoundationPacket(packet), packet);
  for (const p of [
    { ...packet, activationAuthorized: true },
    { ...packet, audience: 'https://www.brndl.online' },
    { ...packet, windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780' },
    { ...packet, extra: true },
  ])
    assert.throws(() => parseFoundationPacket(p));
});
test('inactive native staging defers only the intended unpublished error target and keeps both source hashes', () => {
  const g = graph();
  g.workflow.settings.errorWorkflow = 'OwnedError90';
  const staged = inactiveNativeStagingGraph(g, 'OwnedError90');
  assert.equal(g.workflow.settings.errorWorkflow, 'OwnedError90');
  assert.equal(Object.hasOwn(staged.graph.workflow.settings, 'errorWorkflow'), false);
  assert.deepEqual(staged.graph.workflow.nodes, g.workflow.nodes);
  assert.equal(staged.metadata.deferredErrorWorkflowId, 'OwnedError90');
  assert.notEqual(staged.metadata.intendedSourceHash, staged.metadata.stagedSourceHash);
  assert.equal(staged.metadata.canonicalParity, false);
  assert.throws(() => inactiveNativeStagingGraph(g, 'UnrelatedErrorId'));
});
test('tag phase reuses canonical metadata and never edits shared tags', async () => {
  const tags = foundationTagNames.map((name, i) => ({ id: 'Tag' + i, name: nativeFoundationTagName(name) })),
    calls = [],
    j = createBindingJournal();
  const result = await provisionTags(j, async (m, p, b) => {
    calls.push([m, p, b]);
    return {
      status: 200,
      body: { data: [...tags, { id: 'UNRELATED', name: 'private unrelated label' }], nextCursor: null },
    };
  });
  assert.equal(Object.keys(result).length, 13);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'GET');
  assert.equal(JSON.stringify(result).includes('unrelated'), false);
});
test('tag create intent precedes mutation; ambiguous missing result never blindly recreates', async () => {
  const j = createBindingJournal(),
    calls = [];
  await assert.rejects(
    provisionTags(j, async (m, p) => {
      calls.push([m, p]);
      if (m === 'GET') return { status: 200, body: { data: [], nextCursor: null } };
      throw Error('SYNTHETIC_PRIVATE_ERROR');
    }),
  );
  assert.equal(j.rows[0].event, 'tag_intent');
  await assert.rejects(
    provisionTags(j, async (m) => {
      assert.equal(m, 'GET');
      return { status: 200, body: { data: [], nextCursor: null } };
    }),
  );
});
test('machine is the exact new owned type/domain; response data is not inspected or exported', async () => {
  const j = createBindingJournal(),
    calls = [];
  const metadata = {
    id: 'EmrM03Machine19',
    name: 'M03 foundation machine [dev]',
    type: 'httpCustomAuth',
    createdAt: '2026-10-19T00:00:00.000Z',
  };
  const r = await provisionMachine(packet, machine, j, async (m, p, b) => {
    calls.push([m, p, b]);
    if (p.includes('/schema/'))
      return {
        status: 200,
        body: { properties: { json: {}, allowedHttpRequestDomains: {}, allowedDomains: {} } },
      };
    if (m === 'GET' && calls.filter((x) => x[1].endsWith('EmrM03Machine19')).length === 1)
      return { status: 404, body: {} };
    return { status: 200, body: metadata };
  });
  assert.deepEqual(r, metadata);
  assert.equal(calls.filter((x) => x[0] === 'POST').length, 1);
  assert.equal(JSON.stringify(r).includes(machine), false);
  assert.equal(
    calls.find((x) => x[0] === 'POST')[2].data.allowedDomains,
    'everyone-market-researcher-synthetic-preview.vercel.app',
  );
  const bad = { ...metadata };
  Object.defineProperty(bad, 'data', {
    get() {
      throw Error('PRIVATE_GETTER');
    },
    enumerable: true,
  });
  await assert.rejects(
    provisionMachine(packet, machine, createBindingJournal([{ event: 'machine_intent' }]), async () => ({
      status: 200,
      body: bad,
    })),
    /^Error: FOUNDATION_BIND_BLOCKED$/,
  );
});
const graph = (wf = 'WF-00') => ({
  key: wf,
  workflow: {
    name: foundationWorkflowNames[wf],
    active: false,
    nodes: [
      {
        id: 'N1',
        name: 'Known node',
        type: 'n8n-nodes-base.noOp',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
    ],
    connections: {},
    settings: { timezone: 'Africa/Cairo' },
    tags: [{ id: 'Tag0', name: 'env:dev' }],
    pinData: {},
  },
});
const saved = (g, id = 'Owned0') => ({
  id,
  name: g.workflow.name,
  active: false,
  activeVersionId: null,
  isArchived: false,
  versionId: 'Version1',
  shared: [{ role: 'workflow:owner', projectId: 'pHvQjDmjxVZ3KQLT' }],
  nodes: g.workflow.nodes,
  connections: g.workflow.connections,
  settings: {
    ...g.workflow.settings,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  },
  tags: g.workflow.tags,
  pinData: {},
});
test('saved projection uses exact generated graph fields only and refuses changed parameters/active state', () => {
  const g = graph(),
    r = saved(g);
  Object.defineProperty(r, 'staticData', {
    get() {
      throw Error('PRIVATE_GETTER');
    },
    enumerable: true,
  });
  const p = projectSavedGraph(r, g, 'Owned0');
  assert.equal(p.workflow.name, g.workflow.name);
  for (const mutation of [
    (r) => (r.active = true),
    (r) => (r.nodes = [{ ...g.workflow.nodes[0], parameters: { secret: 'DO_NOT_READ' } }]),
    (r) => (r.settings.saveManualExecutions = true),
  ]) {
    const x = saved(g);
    mutation(x);
    assert.throws(() => projectSavedGraph(x, g, 'Owned0'));
  }
});

test('native binary mode is excluded from PUT and requires explicit editable-only saved projection', () => {
  for (const binaryMode of ['separate', 'combined']) {
    const g = graph();
    g.workflow.settings.binaryMode = binaryMode;
    const body = graphBody(g);
    assert.equal(Object.hasOwn(body.settings, 'binaryMode'), false);
    const dto = saved(g);
    assert.throws(() => projectSavedGraph(dto, g, 'Owned0'));
    const projected = projectSavedGraph(dto, g, 'Owned0', { editableSettingsOnly: true });
    assert.equal(Object.hasOwn(projected.workflow.settings, 'binaryMode'), false);
    for (const mutate of [
      (s) => (s.binaryMode = 'SYNTHETIC_PRIVATE_MODE'),
      (s) => (s.credentialResolverId = 'SYNTHETIC_PRIVATE_RESOLVER'),
      (s) => (s.syntheticUnknownSetting = true),
      (s) => (s.saveManualExecutions = true),
    ]) {
      const changed = saved(g);
      mutate(changed.settings);
      assert.throws(() => projectSavedGraph(changed, g, 'Owned0', { editableSettingsOnly: true }));
    }
  }
  const invalidGraph = graph();
  invalidGraph.workflow.settings.binaryMode = 'SYNTHETIC_PRIVATE_MODE';
  assert.throws(() => graphBody(invalidGraph));
});

test('ordinary owned WF00 saved projection requires the fixed native tuple and preserves it outside editable body', () => {
  const g = graph(),
    workflowId = 'MzimjpsuyPuK7SKe',
    dto = saved(g, workflowId),
    nativeReadonlySettings = { binaryMode: 'separate' };
  dto.settings.binaryMode = 'separate';
  const projected = projectSavedGraph(dto, g, workflowId, { nativeReadonlySettings });
  assert.deepEqual(projected.nativeReadonlySettings, nativeReadonlySettings);
  assert.equal(Object.hasOwn(projected.workflow.settings, 'binaryMode'), false);
  for (const changed of [undefined, 'combined', 'SYNTHETIC_PRIVATE_MODE']) {
    const altered = structuredClone(dto);
    if (changed === undefined) delete altered.settings.binaryMode;
    else altered.settings.binaryMode = changed;
    assert.throws(() => projectSavedGraph(altered, g, workflowId, { nativeReadonlySettings }));
  }
  assert.throws(() =>
    projectSavedGraph(dto, g, workflowId, { nativeReadonlySettings: { binaryMode: 'combined' } }),
  );
  assert.throws(() => projectSavedGraph(dto, graph('WF-10'), workflowId, { nativeReadonlySettings }));
});
test('graph and tag PUT each have durable intent and one GET; no activate/execute route', async () => {
  const g = graph(),
    j = createBindingJournal(),
    calls = [];
  const r = await bindOwnedGraphs(
    [g],
    { 'WF-00': { id: 'Owned0', name: g.workflow.name } },
    j,
    async (m, p, b) => {
      calls.push([m, p, b]);
      return {
        status: 200,
        body:
          m === 'GET'
            ? calls.length === 1
              ? {
                  ...buildShell('WF-00'),
                  id: 'Owned0',
                  active: false,
                  activeVersionId: null,
                  isArchived: false,
                  versionId: 'Version1',
                  shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
                }
              : saved(g)
            : {},
      };
    },
    { allowSubsetForTests: true },
  );
  assert.equal(r.length, 1);
  assert.deepEqual(
    calls.map((x) => x[0]),
    ['GET', 'PUT', 'PUT', 'GET'],
  );
  assert.equal(j.rows[0].event, 'graph_intent');
  assert.ok(j.rows.some((x) => x.event === 'tags_intent'));
  assert.equal(JSON.stringify(calls).includes('/activate'), false);
});
test('ambiguous graph PUT reconciles GET-only and cannot be replayed when old shape remains', async () => {
  const g = graph(),
    j = createBindingJournal();
  await assert.rejects(
    bindOwnedGraphs(
      [g],
      { 'WF-00': { id: 'Owned0', name: g.workflow.name } },
      j,
      async (m) => {
        if (m === 'GET')
          return {
            status: 200,
            body: {
              ...buildShell('WF-00'),
              id: 'Owned0',
              active: false,
              activeVersionId: null,
              isArchived: false,
              versionId: 'Version1',
              shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
            },
          };
        throw Error('SYNTHETIC_PRIVATE_ERROR');
      },
      { allowSubsetForTests: true },
    ),
  );
  let gets = 0;
  await assert.rejects(
    bindOwnedGraphs(
      [g],
      { 'WF-00': { id: 'Owned0', name: g.workflow.name } },
      j,
      async (m) => {
        assert.equal(m, 'GET');
        gets++;
        return { status: 200, body: {} };
      },
      { allowSubsetForTests: true },
    ),
  );
  assert.equal(gets, 1);
});
test('unexpected executable flags cannot receive a verified saved-graph receipt', () => {
  for (const flag of ['continueOnFail', 'executeOnce', 'alwaysOutputData', 'retryOnFail', 'disabled']) {
    const g = graph(),
      r = saved(g);
    r.nodes = [{ ...g.workflow.nodes[0], [flag]: true }];
    assert.throws(() => projectSavedGraph(r, g, 'Owned0'));
  }
  for (const [flag, value] of [
    ['maxTries', 5],
    ['waitBetweenTries', 200],
    ['extendsCredential', 'OtherCredential'],
  ]) {
    const g = graph(),
      r = saved(g);
    r.nodes = [{ ...g.workflow.nodes[0], [flag]: value }];
    assert.throws(() => projectSavedGraph(r, g, 'Owned0'));
  }
});
test('unexpected workflow settings cannot change error or caller behavior behind a verified receipt', () => {
  for (const [setting, value] of [
    ['errorWorkflow', 'UnrelatedNotifier'],
    ['callerIds', ['UnrelatedCaller']],
    ['availableInMCP', true],
  ]) {
    const g = graph('WF-90'),
      r = saved(g);
    r.settings[setting] = value;
    assert.throws(() => projectSavedGraph(r, g, 'Owned0'));
  }
});

const tagContract = JSON.parse(readFileSync('n8n/foundation/native-tag-contract.2.43.5.json', 'utf8'));
const tagLimits = /@Length\((\d+), (\d+),/.exec(tagContract.lengthExcerpt).slice(1).map(Number);
const nativeTagValid = (name) =>
  typeof name === 'string' && name.trim().length >= tagLimits[0] && name.trim().length <= tagLimits[1];
test('pinned native TagEntity contract rejects three old logical names and validates every actual native label', () => {
  assert.deepEqual(tagLimits, [1, 24]);
  assert.equal(nativeTagValid('x'.repeat(24)), true);
  assert.equal(nativeTagValid('x'.repeat(25)), false);
  assert.deepEqual(
    foundationTagNames.filter((x) => !nativeTagValid(x)),
    ['platform:instagram_stories', 'platform:linkedin_employees', 'platform:website_work_page'],
  );
  const labels = foundationTagNames.map(nativeFoundationTagName);
  assert.equal(new Set(labels).size, 13);
  assert.ok(labels.every(nativeTagValid));
  const base = JSON.parse(readFileSync('n8n/foundation/bindings.dev.json', 'utf8'));
  assert.equal(
    n8nBindingsSchema.safeParse({
      ...base,
      tagRefs: {
        'platform:instagram_stories': { id: 'SyntheticNativeTag', name: 'platform:instagram_stories' },
      },
    }).success,
    false,
  );
  assert.equal(
    n8nBindingsSchema.safeParse({
      ...base,
      tagRefs: { 'platform:instagram_stories': { id: 'SyntheticNativeTag', name: 'platform:ig_stories' } },
    }).success,
    true,
  );
});
function priorTagCheckpoint() {
  const names = foundationTagNames.slice(0, 7),
    tags = names.map((name, i) => ({ name, id: 'ExistingTag' + i }));
  const rows = tags.flatMap((t) => [
    { event: 'tag_intent', name: t.name },
    { event: 'tag_ack', name: t.name, id: t.id, created: true },
  ]);
  rows.push({ event: 'tag_intent', name: 'platform:instagram_stories' });
  return { tags, rows };
}
test('existing15events and seven tags survive a complete GET reconciliation then distinct valid native creation', async () => {
  const f = priorTagCheckpoint(),
    j = createBindingJournal(f.rows),
    calls = [];
  const result = await provisionTags(j, async (m, p, b) => {
    calls.push({ m, p, b });
    if (p.startsWith('/api/v1/tags?')) return { status: 200, body: { data: f.tags, nextCursor: null } };
    if (m === 'POST') {
      assert.equal(nativeTagValid(b.name), true);
      assert.notEqual(b.name, 'platform:instagram_stories');
      const row = { id: 'NewTag' + f.tags.length, name: b.name };
      f.tags.push(row);
      return { status: 201, body: row };
    }
    return { status: 200, body: f.tags.find((t) => p.endsWith('/' + t.id)) };
  });
  assert.deepEqual(j.rows.slice(0, 15), f.rows);
  assert.equal(calls[0].m, 'GET');
  const transition = j.rows[15];
  assert.deepEqual(transition, {
    event: 'tag_native_intent',
    name: 'platform:instagram_stories',
    nativeName: 'platform:ig_stories',
    replacesLegacy: true,
    scan: 'complete_absent',
  });
  assert.equal(calls.filter((c) => c.m === 'POST').length, 6);
  assert.equal(result['platform:instagram_stories'].name, 'platform:ig_stories');
  for (const t of f.tags.slice(0, 7)) assert.equal(result[t.name].id, t.id);
});
test('ambiguous replacement never replays either the old long request or its new native intent', async () => {
  const f = priorTagCheckpoint(),
    j = createBindingJournal(f.rows);
  await assert.rejects(
    provisionTags(j, async (m) => {
      if (m === 'GET') return { status: 200, body: { data: f.tags, nextCursor: null } };
      throw Error('SYNTHETIC_AMBIGUOUS');
    }),
  );
  assert.equal(j.rows[15].event, 'tag_native_intent');
  let calls = 0;
  await assert.rejects(
    provisionTags(j, async (m) => {
      assert.equal(m, 'GET');
      calls++;
      return { status: 200, body: { data: f.tags, nextCursor: null } };
    }),
  );
  assert.equal(calls, 1);
});
test('an unexpected existing long native tag stops before replacement or any new mutation', async () => {
  const f = priorTagCheckpoint(),
    j = createBindingJournal(f.rows);
  f.tags.push({ id: 'UnexpectedOldLongTag', name: 'platform:instagram_stories' });
  await assert.rejects(
    provisionTags(j, async (m) => {
      assert.equal(m, 'GET');
      return { status: 200, body: { data: f.tags, nextCursor: null } };
    }),
  );
  assert.deepEqual(j.rows, f.rows);
});
