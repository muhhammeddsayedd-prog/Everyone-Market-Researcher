import { createHash } from 'node:crypto';
import {
  foundationTagNames,
  foundationWorkflowNames,
  foundationNativeTagNames,
  nativeFoundationTagName,
} from '../../packages/shared/src/n8n-bindings.ts';
import { foundationScope, verifyShell } from './foundation-provision.mjs';
import {
  foundationEditableSettings,
  foundationNativeReadonlySettings,
  foundationRuntimeNativeReadonlyPin,
  foundationRuntimeCheckpoint,
} from './foundation-runtime-checkpoint.mjs';
import { isDeepStrictEqual } from 'node:util';
const bad = () => {
  throw Error('FOUNDATION_BIND_BLOCKED');
};
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) =>
  object(x) && Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const id = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const machineId = 'EmrM03Machine19',
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
  const tagOwners = new Map();
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
    } else if (r.event === 'tag_native_intent') {
      if (
        !exact(r, ['event', 'name', 'nativeName', 'replacesLegacy', 'scan']) ||
        !foundationTagNames.includes(r.name) ||
        nativeFoundationTagName(r.name) === r.name ||
        r.nativeName !== nativeFoundationTagName(r.name) ||
        typeof r.replacesLegacy !== 'boolean' ||
        r.replacesLegacy !== intents.has('tag:' + r.name) ||
        r.scan !== 'complete_absent' ||
        intents.has('native:' + r.name) ||
        tagIds.has(r.name)
      )
        bad();
      intents.set('native:' + r.name, true);
    } else if (r.event === 'tag_ack') {
      if (
        !exact(
          r,
          foundationTagNames.includes(r.name) && nativeFoundationTagName(r.name) !== r.name
            ? ['event', 'name', 'id', 'created', 'nativeName']
            : ['event', 'name', 'id', 'created'],
        ) ||
        !foundationTagNames.includes(r.name) ||
        !id(r.id) ||
        typeof r.created !== 'boolean' ||
        (nativeFoundationTagName(r.name) !== r.name && r.nativeName !== nativeFoundationTagName(r.name)) ||
        (r.created &&
          !intents.has((nativeFoundationTagName(r.name) !== r.name ? 'native:' : 'tag:') + r.name)) ||
        (tagOwners.has(r.id) && tagOwners.get(r.id) !== r.name) ||
        (tagIds.has(r.name) && tagIds.get(r.name) !== r.id)
      )
        bad();
      tagIds.set(r.name, r.id);
      tagOwners.set(r.id, r.name);
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
    seen = new Set(),
    seenIds = new Set(),
    legacyNames = new Set();
  const nativeToLogical = new Map(
    Object.entries(foundationNativeTagNames).map(([key, label]) => [label, key]),
  );
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
      if (foundationTagNames.includes(x.name) && nativeFoundationTagName(x.name) !== x.name)
        legacyNames.add(x.name);
      const key = nativeToLogical.get(x.name);
      if (!key) continue;
      if (!id(x.id) || seen.has(x.name) || seenIds.has(x.id)) bad();
      seen.add(x.name);
      seenIds.add(x.id);
      refs[key] = { id: x.id, name: x.name };
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
  // Reconcile every completed/ambiguous tag before any new mutation. The failed
  // overlength legacy intent is retained; a distinct native intent is permitted
  // only after this complete GET scan proves both old and replacement absent.
  for (const name of foundationTagNames) {
    const label = nativeFoundationTagName(name),
      alias = label !== name;
    const intent = latest(j, 'tag_intent', 'name', name),
      nativeIntent = latest(j, 'tag_native_intent', 'name', name),
      ack = latest(j, 'tag_ack', 'name', name);
    if (legacyNames.has(name)) bad();
    if (ack && (!refs[name] || ack.id !== refs[name].id)) bad();
    if ((alias ? nativeIntent : intent) && !ack && !refs[name]) {
      if (!alias) bad();
      // An already-issued replacement request is never replayed after ambiguity.
      if (nativeIntent) bad();
    }
  }
  for (const name of foundationTagNames) {
    const label = nativeFoundationTagName(name),
      alias = label !== name;
    const intent = latest(j, 'tag_intent', 'name', name),
      nativeIntent = latest(j, 'tag_native_intent', 'name', name),
      ack = latest(j, 'tag_ack', 'name', name);
    if (refs[name]) {
      if (!ack)
        j.append({
          event: 'tag_ack',
          name,
          id: refs[name].id,
          created: Boolean(alias ? nativeIntent : intent),
          ...(alias ? { nativeName: label } : {}),
        });
      continue;
    }
    if (ack || nativeIntent || (!alias && intent)) bad();
    if (alias)
      j.append({
        event: 'tag_native_intent',
        name,
        nativeName: label,
        replacesLegacy: Boolean(intent),
        scan: 'complete_absent',
      });
    else j.append({ event: 'tag_intent', name });
    const created = await send('POST', '/api/v1/tags', { name: label });
    if (
      ![200, 201].includes(created.status) ||
      !object(created.body) ||
      created.body.name !== label ||
      !id(created.body.id)
    )
      bad();
    const r = await send('GET', '/api/v1/tags/' + created.body.id, null);
    if (r.status !== 200 || !object(r.body) || r.body.id !== created.body.id || r.body.name !== label) bad();
    refs[name] = { id: r.body.id, name: label };
    j.append({
      event: 'tag_ack',
      name,
      id: r.body.id,
      created: true,
      ...(alias ? { nativeName: label } : {}),
    });
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
  ...foundationEditableSettings(settings),
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
  return JSON.parse(
    JSON.stringify({
      name: graph.workflow.name,
      nodes: graph.workflow.nodes,
      connections: graph.workflow.connections,
      settings: safeSettings(graph.workflow.settings),
    }),
  );
}
export function inactiveNativeStagingGraph(graph, errorWorkflowId) {
  if (!id(errorWorkflowId)) bad();
  const intended = graphBody(graph),
    staged = structuredClone(graph);
  const deferred = intended.settings.errorWorkflow ?? null;
  if (graph.key === 'WF-90') {
    if (Object.hasOwn(intended.settings, 'errorWorkflow')) bad();
  } else if (deferred !== errorWorkflowId) bad();
  if (deferred !== null) delete staged.workflow.settings.errorWorkflow;
  const stagedBody = graphBody(staged);
  return {
    graph: staged,
    metadata: {
      definitionProfile: 'inactive_native_staging',
      deferredErrorWorkflowId: deferred,
      intendedSourceHash: hash(intended),
      stagedSourceHash: hash(stagedBody),
      canonicalParity: deferred === null,
    },
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
export function projectSavedGraph(
  dto,
  graph,
  expectedId,
  { requireTags = true, editableSettingsOnly = false, nativeReadonlySettings } = {},
) {
  const expected = graphBody(graph);
  const native =
    nativeReadonlySettings === undefined
      ? null
      : foundationRuntimeNativeReadonlyPin({
          key: graph.key,
          id: expectedId,
          nativeReadonlySettings,
        });
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
  if (native && !isDeepStrictEqual(foundationNativeReadonlySettings(dto.settings), native)) bad();
  sameKnown(
    native || editableSettingsOnly ? foundationEditableSettings(dto.settings) : dto.settings,
    expected.settings,
  );
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
    tags.some((t) => !object(t) || !id(t.id) || !Object.values(foundationNativeTagNames).includes(t.name))
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
    ...(native ? { nativeReadonlySettings: structuredClone(native) } : {}),
    workflow: { ...expected, tags: tags.map((t) => ({ id: t.id, name: t.name })), pinData: {} },
  };
}
function pinnedProjectionOptions(graph, id, options = {}) {
  const pin = foundationRuntimeCheckpoint.workflows['WF-00'];
  return graph.key === 'WF-00' && id === pin.id && pin.nativeReadonlySettings
    ? { ...options, nativeReadonlySettings: pin.nativeReadonlySettings }
    : options;
}
export async function bindOwnedGraphs(
  graphs,
  workflowRefs,
  j,
  send,
  { allowSubsetForTests = false, onVerified } = {},
) {
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
    if (intent)
      projectSavedGraph(before.body, g, ref.id, pinnedProjectionOptions(g, ref.id, { requireTags: false }));
    else verifyShell(before.body, g.key);
    if (!intent) {
      j.append({ event: 'graph_intent', key: g.key, id: ref.id, hash: sourceHash });
      const r = await send('PUT', '/api/v1/workflows/' + ref.id + '?publishIfActive=false', body);
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
      projectSavedGraph(before.body, g, ref.id, pinnedProjectionOptions(g, ref.id));
      j.append({ event: 'tags_saved', key: g.key, id: ref.id, hash: tagHash });
    }
    const r = await send('GET', '/api/v1/workflows/' + ref.id, null);
    if (r.status !== 200) bad();
    const verified = {
      key: g.key,
      ...projectSavedGraph(r.body, g, ref.id, pinnedProjectionOptions(g, ref.id)),
    };
    if (onVerified) await onVerified(verified);
    saved.push(verified);
  }
  return saved;
}
