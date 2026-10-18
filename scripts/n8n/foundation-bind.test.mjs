import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foundationTagNames, foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import {
  parseFoundationPacket,
  provisionTags,
  provisionMachine,
  bindOwnedGraphs,
  createBindingJournal,
  projectSavedGraph,
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
test('tag phase reuses canonical metadata and never edits shared tags', async () => {
  const tags = foundationTagNames.map((name, i) => ({ id: 'Tag' + i, name })),
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
    id: 'EmrFoundationMachine19',
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
    if (m === 'GET' && calls.filter((x) => x[1].endsWith('EmrFoundationMachine19')).length === 1)
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
