import { createHash } from 'node:crypto';
import { foundationTagNames, foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import { foundationScope, verifyShell } from './foundation-provision.mjs';
const bad = () => {
  throw Error('FOUNDATION_BIND_BLOCKED');
};
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) =>
  object(x) && Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const id = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const machineId = 'EmrFoundationMachine19',
  machineName = 'M03 foundation machine [dev]';
export function parseFoundationPacket(p) {
  if (
    !exact(p, [
      'version',
      'windowId',
      'audience',
      'sourceCommitSha',
      'deploymentId',
      'environment',
      'activationAuthorized',
    ]) ||
    p.version !== 1 ||
    p.windowId !== foundationScope.windowId ||
    p.environment !== 'preview' ||
    p.activationAuthorized !== false ||
    typeof p.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(p.audience) ||
    !/^[a-f0-9]{40}$/.test(p.sourceCommitSha) ||
    !/^dpl_[A-Za-z0-9]{1,100}$/.test(p.deploymentId)
  )
    bad();
  return structuredClone(p);
}
export function createBindingJournal(initial = [], durableAppend = () => {}) {
  const rows = structuredClone(initial);
  const j = {
    rows,
    append(row) {
      validateBindingRows([...rows, row]);
      durableAppend(row);
      rows.push(structuredClone(row));
    },
  };
  validateBindingRows(rows);
  return j;
}
function validateBindingRows(rows) {
  if (!Array.isArray(rows) || rows.length > 250) bad();
  const intents = new Map(),
    tagIds = new Map();
  let knownMachine = null;
  for (const r of rows) {
    if (!object(r)) bad();
    if (r.event === 'tag_intent') {
      if (
        !exact(r, ['event', 'name']) ||
        !foundationTagNames.includes(r.name) ||
        intents.has('tag:' + r.name)
      )
        bad();
      intents.set('tag:' + r.name, true);
    } else if (r.event === 'tag_ack') {
      if (
        !exact(r, ['event', 'name', 'id', 'created']) ||
        !foundationTagNames.includes(r.name) ||
        !id(r.id) ||
        typeof r.created !== 'boolean' ||
        (r.created && !intents.has('tag:' + r.name)) ||
        (tagIds.has(r.name) && tagIds.get(r.name) !== r.id)
      )
        bad();
      tagIds.set(r.name, r.id);
    } else if (r.event === 'machine_intent') {
      if (!exact(r, ['event']) || intents.has('machine')) bad();
      intents.set('machine', true);
    } else if (r.event === 'machine_ack') {
      if (!exact(r, ['event', 'credential']) || !intents.has('machine')) bad();
      const m = machineMetadata(r.credential);
      if (knownMachine && JSON.stringify(knownMachine) !== JSON.stringify(m)) bad();
      knownMachine = m;
    } else if (['graph_intent', 'graph_saved', 'tags_intent', 'tags_saved'].includes(r.event)) {
      if (
        !exact(r, ['event', 'key', 'id', 'hash']) ||
        !Object.hasOwn(foundationWorkflowNames, r.key) ||
        !id(r.id) ||
        !/^[a-f0-9]{64}$/.test(r.hash)
      )
        bad();
      const base = r.event.startsWith('graph') ? 'graph' : 'tags',
        k = base + ':' + r.key;
      if (r.event.endsWith('intent')) {
        if (intents.has(k)) bad();
        intents.set(k, r);
      } else {
        const prior = intents.get(k);
        if (!prior || prior.id !== r.id || prior.hash !== r.hash) bad();
      }
    } else bad();
  }
}
const latest = (j, event, keyField, key) =>
  j.rows.findLast((x) => x.event === event && (!keyField || x[keyField] === key));
export async function provisionTags(j, send) {
  validateBindingRows(j.rows);
  const refs = {},
    seen = new Set();
  let cursor = null;
  for (let page = 0; page < 2; page++) {
    const r = await send(
      'GET',
      '/api/v1/tags?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      null,
    );
    if (r.status !== 200 || !object(r.body) || !Array.isArray(r.body.data) || r.body.data.length > 100) bad();
    for (const x of r.body.data) {
      if (!object(x)) bad();
      if (!foundationTagNames.includes(x.name)) continue;
      if (!id(x.id) || seen.has(x.name)) bad();
      seen.add(x.name);
      refs[x.name] = { id: x.id, name: x.name };
    }
    const next = r.body.nextCursor;
    if (next === null || next === undefined) {
      cursor = null;
      break;
    }
    if (
      typeof next !== 'string' ||
      !next ||
      next.length > 400 ||
      /[\x00-\x20\x7f]/.test(next) ||
      next === cursor
    )
      bad();
    cursor = next;
  }
  if (cursor !== null) bad();
  for (const name of foundationTagNames) {
    const intent = latest(j, 'tag_intent', 'name', name),
      ack = latest(j, 'tag_ack', 'name', name);
    if (refs[name]) {
      if (ack && ack.id !== refs[name].id) bad();
      if (!ack) j.append({ event: 'tag_ack', name, id: refs[name].id, created: Boolean(intent) });
      continue;
    }
    if (intent || ack) bad();
    j.append({ event: 'tag_intent', name });
    const created = await send('POST', '/api/v1/tags', { name });
    if (
      ![200, 201].includes(created.status) ||
      !object(created.body) ||
      created.body.name !== name ||
      !id(created.body.id)
    )
      bad();
    const r = await send('GET', '/api/v1/tags/' + created.body.id, null);
    if (r.status !== 200 || !object(r.body) || r.body.id !== created.body.id || r.body.name !== name) bad();
    refs[name] = { id: r.body.id, name };
    j.append({ event: 'tag_ack', name, id: r.body.id, created: true });
  }
  if (new Set(Object.values(refs).map((x) => x.id)).size !== 13) bad();
  return refs;
}
function machineMetadata(v) {
  if (
    !object(v) ||
    Object.hasOwn(v, 'data') ||
    v.id !== machineId ||
    v.name !== machineName ||
    v.type !== 'httpCustomAuth' ||
    typeof v.createdAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.createdAt) ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    bad();
  return { id: v.id, name: v.name, type: v.type, createdAt: v.createdAt };
}
export function machineBody(packet, machine) {
  parseFoundationPacket(packet);
  if (typeof machine !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(machine)) bad();
  return {
    id: machineId,
    name: machineName,
    type: 'httpCustomAuth',
    projectId: foundationScope.projectId,
    data: {
      json: JSON.stringify({ headers: { Authorization: 'Bearer ' + machine } }),
      allowedHttpRequestDomains: 'domains',
      allowedDomains: new URL(packet.audience).hostname,
    },
  };
}
export async function provisionMachine(packet, machine, j, send) {
  parseFoundationPacket(packet);
  machineBody(packet, machine);
  validateBindingRows(j.rows);
  const prior = latest(j, 'machine_intent'),
    ack = latest(j, 'machine_ack');
  if (prior) {
    const r = await send('GET', '/api/v1/credentials/' + machineId, null);
    if (r.status !== 200) bad();
    const m = machineMetadata(r.body);
    if (ack && JSON.stringify(m) !== JSON.stringify(ack.credential)) bad();
    if (!ack) j.append({ event: 'machine_ack', credential: m });
    return m;
  }
  const schema = await send('GET', '/api/v1/credentials/schema/httpCustomAuth', null);
  if (
    schema.status !== 200 ||
    !object(schema.body?.properties) ||
    !['json', 'allowedHttpRequestDomains', 'allowedDomains'].every((k) =>
      Object.hasOwn(schema.body.properties, k),
    )
  )
    bad();
  const existing = await send('GET', '/api/v1/credentials/' + machineId, null);
  if (existing.status !== 404) bad();
  j.append({ event: 'machine_intent' });
  const created = await send('POST', '/api/v1/credentials', machineBody(packet, machine));
  if (created.status !== 200) bad();
  const metadata = machineMetadata(created.body);
  const r = await send('GET', '/api/v1/credentials/' + machineId, null);
  if (r.status !== 200 || JSON.stringify(machineMetadata(r.body)) !== JSON.stringify(metadata)) bad();
  j.append({ event: 'machine_ack', credential: metadata });
  return metadata;
}
const safeSettings = (settings) => ({
  ...settings,
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'none',
  saveManualExecutions: false,
  saveExecutionProgress: false,
});
export function graphBody(graph) {
  if (
    !object(graph) ||
    !Object.hasOwn(foundationWorkflowNames, graph.key) ||
    !object(graph.workflow) ||
    graph.workflow.name !== foundationWorkflowNames[graph.key] ||
    graph.workflow.active !== false ||
    !Array.isArray(graph.workflow.nodes) ||
    !object(graph.workflow.connections) ||
    !object(graph.workflow.settings)
  )
    bad();
  return {
    name: graph.workflow.name,
    nodes: graph.workflow.nodes,
    connections: graph.workflow.connections,
    settings: safeSettings(graph.workflow.settings),
  };
}
function sameKnown(actual, expected) {
  if (expected === null || typeof expected !== 'object') {
    if (actual !== expected) bad();
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) bad();
    const descriptors = Object.getOwnPropertyDescriptors(actual);
    for (let i = 0; i < expected.length; i++) {
      const d = descriptors[i];
      if (!d || !Object.hasOwn(d, 'value')) bad();
      sameKnown(d.value, expected[i]);
    }
    return;
  }
  if (!object(actual) || Object.keys(actual).sort().join('\0') !== Object.keys(expected).sort().join('\0'))
    bad();
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  for (const k of Object.keys(expected)) {
    const d = descriptors[k];
    if (!d || !Object.hasOwn(d, 'value')) bad();
    sameKnown(d.value, expected[k]);
  }
}
export function projectSavedGraph(dto, graph, expectedId, { requireTags = true } = {}) {
  const expected = graphBody(graph);
  if (
    !object(dto) ||
    dto.id !== expectedId ||
    !id(dto.id) ||
    !id(dto.versionId) ||
    dto.name !== expected.name ||
    dto.active !== false ||
    dto.activeVersionId !== null ||
    dto.isArchived !== false ||
    !Array.isArray(dto.shared) ||
    !dto.shared.some(
      (x) => object(x) && x.projectId === foundationScope.projectId && x.role === 'workflow:owner',
    ) ||
    !Array.isArray(dto.nodes) ||
    dto.nodes.length !== expected.nodes.length ||
    !object(dto.settings)
  )
    bad();
  for (let i = 0; i < expected.nodes.length; i++) {
    const actual = dto.nodes[i],
      want = expected.nodes[i];
    if (!object(actual)) bad();
    const allowed = new Set(Object.keys(want));
    for (const k of [
      'credentials',
      'webhookId',
      'retryOnFail',
      'onError',
      'disabled',
      'continueOnFail',
      'executeOnce',
      'alwaysOutputData',
      'maxTries',
      'waitBetweenTries',
      'extendsCredential',
    ])
      if (
        Object.hasOwn(actual, k) &&
        !allowed.has(k) &&
        !(
          ['disabled', 'continueOnFail', 'executeOnce', 'alwaysOutputData', 'retryOnFail'].includes(k) &&
          actual[k] === false
        )
      )
        bad();
    for (const k of Object.keys(want)) sameKnown(actual[k], want[k]);
  }
  sameKnown(dto.connections, expected.connections);
  sameKnown(dto.settings, expected.settings);
  if (
    dto.pinData !== null &&
    dto.pinData !== undefined &&
    (!object(dto.pinData) || Object.keys(dto.pinData).length)
  )
    bad();
  const tags = graph.workflow.tags;
  if (
    !Array.isArray(tags) ||
    !tags.length ||
    tags.some((t) => !object(t) || !id(t.id) || !foundationTagNames.includes(t.name))
  )
    bad();
  if (requireTags) {
    if (!Array.isArray(dto.tags) || dto.tags.length !== tags.length) bad();
    const actual = dto.tags.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.id.localeCompare(b.id));
    sameKnown(
      actual,
      [...tags].map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.id.localeCompare(b.id)),
    );
  }
  return {
    id: dto.id,
    versionId: dto.versionId,
    active: false,
    activeVersionId: null,
    projectId: foundationScope.projectId,
    workflow: { ...expected, tags: tags.map((t) => ({ id: t.id, name: t.name })), pinData: {} },
  };
}
export async function bindOwnedGraphs(graphs, workflowRefs, j, send, { allowSubsetForTests = false } = {}) {
  validateBindingRows(j.rows);
  if (
    !Array.isArray(graphs) ||
    (!allowSubsetForTests && graphs.length !== 25) ||
    graphs.length > 25 ||
    new Set(graphs.map((g) => g.key)).size !== graphs.length
  )
    bad();
  const saved = [];
  for (const g of graphs) {
    const ref = workflowRefs[g.key];
    if (!object(ref) || !id(ref.id) || ref.name !== foundationWorkflowNames[g.key]) bad();
    const body = graphBody(g),
      sourceHash = hash(body),
      intent = latest(j, 'graph_intent', 'key', g.key),
      ack = latest(j, 'graph_saved', 'key', g.key);
    if (intent && (intent.id !== ref.id || intent.hash !== sourceHash)) bad();
    const before = await send('GET', '/api/v1/workflows/' + ref.id, null);
    if (before.status !== 200) bad();
    if (intent) projectSavedGraph(before.body, g, ref.id, { requireTags: false });
    else verifyShell(before.body, g.key);
    if (!intent) {
      j.append({ event: 'graph_intent', key: g.key, id: ref.id, hash: sourceHash });
      const r = await send('PUT', '/api/v1/workflows/' + ref.id, body);
      if (r.status !== 200) bad();
      j.append({ event: 'graph_saved', key: g.key, id: ref.id, hash: sourceHash });
    } else if (!ack) j.append({ event: 'graph_saved', key: g.key, id: ref.id, hash: sourceHash });
    const tagBody = g.workflow.tags.map((t) => ({ id: t.id })),
      tagHash = hash(tagBody),
      tagIntent = latest(j, 'tags_intent', 'key', g.key),
      tagAck = latest(j, 'tags_saved', 'key', g.key);
    if (tagIntent && (tagIntent.id !== ref.id || tagIntent.hash !== tagHash)) bad();
    if (!tagIntent) {
      j.append({ event: 'tags_intent', key: g.key, id: ref.id, hash: tagHash });
      const r = await send('PUT', '/api/v1/workflows/' + ref.id + '/tags', tagBody);
      if (r.status !== 200) bad();
      j.append({ event: 'tags_saved', key: g.key, id: ref.id, hash: tagHash });
    } else if (!tagAck) {
      projectSavedGraph(before.body, g, ref.id);
      j.append({ event: 'tags_saved', key: g.key, id: ref.id, hash: tagHash });
    }
    const r = await send('GET', '/api/v1/workflows/' + ref.id, null);
    if (r.status !== 200) bad();
    saved.push({ key: g.key, ...projectSavedGraph(r.body, g, ref.id) });
  }
  return saved;
}
