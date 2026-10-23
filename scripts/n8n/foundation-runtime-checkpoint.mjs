import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Exact saved staging identity; this is not a runtime/deployment or live-acceptance receipt.
export const foundationRuntimeCheckpoint = {
  kind: 'actual_inactive_checkpoint_only',
  observedReceipt: 'da8fd3',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  projectId: 'pHvQjDmjxVZ3KQLT',
  machine: {
    id: 'EmrM03Machine19',
    name: 'M03 foundation machine [dev]',
    type: 'httpCustomAuth',
    createdAt: '2026-10-19T00:25:21.669Z',
  },
  workflows: {
    'WF-10': {
      id: '4JMHLDBSdgGxhPlk',
      versionId: 'd3191e0b-80a7-48c0-953b-f31fc78899de',
      recordHash: '41a9aa4f1addcb823967f62550d89a2270ff9ed945d45d3dff088052bf3742c1',
      stagedSourceHash: '8e41993dde2f2f48265416d7163c467aadd77cba94ffc936b04c0b8fdbc94692',
    },
    'WF-11': {
      id: 'Oq19AMI9C3B1wbo9',
      versionId: '9ffb2a4e-1747-477f-b1d2-69a14a803155',
      recordHash: '62934f83ff2369fd50575d7009fcfe3c8d47cb5abca7b90926b3d2cddb781a4e',
      stagedSourceHash: '2114c5320f8ea052c63060624768646f6feb459b229a1dd7e353f21675b14025',
    },
    'WF-12': {
      id: '8pz1lF0xPDQCs3ab',
      versionId: '8a23fbff-e07d-4180-8bbc-2ef1db8512c3',
      recordHash: '445fef1465dd460d481149962a0aa36818a42ef3a966c586bec4d33eccc0b718',
      stagedSourceHash: 'de084846bcc388ca2cd8c0fc7bcf6e504990610f6b3651d8ffb09f77fb82eff6',
    },
    'WF-13': {
      id: 'F7S8Llr0ZSaSuw4T',
      versionId: 'f8f7d305-abb6-4836-a9e8-7def4371fa78',
      recordHash: '2bd9fec3a8b08c11c524112069efbda7d2c844f8f975a612a5c185ef92e6e5df',
      stagedSourceHash: '2a47711557618b4dfbb16a360fb65d9ce0805d41f3e6aa76d4b4f2155e2d655a',
    },
    'WF-18': {
      id: 'VbJn4mLYm0sGy1X2',
      versionId: '13560120-52e8-4045-adf7-ed28ad0bc884',
      recordHash: '9d8ac9846cc41481f4c0f12724ffe9f1c7cfe4735500c704d1a747dd486bb3bf',
      stagedSourceHash: '29756f7c5f53956668106e2aac07387ff346ef6624b0a67fa37a27b098c0744f',
    },
    'WF-18b': {
      id: 'h6lUXSGN5sV2jxuQ',
      versionId: '1d0a7886-106b-4be9-bb83-1cbad52ae29f',
      recordHash: 'fbc39c875547b61d355fd5ef49e293de94c4b6873c1d3c3b7ad0e83328ad12db',
      stagedSourceHash: 'b08051519ef6c8c106fc233e7646b4059abca77e1d41ec254142e0aefe1bfeb2',
    },
    'WF-21': {
      id: '02yefa9uEPYwmM3N',
      versionId: '70200b45-5c84-4117-a1be-94ec9fa7354a',
      recordHash: '73132dc49065c715d79d127cf413cff3c42a30a71fa38f84e8656620854a9c3d',
      stagedSourceHash: 'c0e7a9b36da78d98e7bb414efd9bfb4b9f49ea2ddf724e8f27cf1e74e4d78d7f',
    },
    'WF-22': {
      id: '83LybyawRpHXbjx6',
      versionId: '4650fcfe-3b9b-47ae-ad9d-85eb8656b1df',
      recordHash: '49016b24ce6a479b070d593ceff3fe7bc2f0cc54176e309339403dc54881f555',
      stagedSourceHash: '7096faaf7b62d01b3be1a3e610a74dc1fdf5500cf0f571f839c00ac8c3fba700',
    },
    'WF-23': {
      id: 'qzgT9giRQJ7eMDmV',
      versionId: '03b0709e-ba83-4314-ad4b-98135143a6b7',
      recordHash: 'a73a5ef23f961f8db027f2969f51a1a6189ce6443ffefc953d50d6a316e95c81',
      stagedSourceHash: '887028f8ad0ad6cbd7959d6effe5b752cde7b52f821e1539d95e632024c7abbb',
    },
    'WF-30': {
      id: 'mySfLZbU7I1850uP',
      versionId: '5248f711-8983-42fc-978d-2014b8446887',
      recordHash: 'bbf12270eb5cb405993e58de98aabb7dc5a32979eefc0887ba67250fb7335c0a',
      stagedSourceHash: 'ec23b2e2b9f58ed80bb9516e17943762e542189b8315e473c3d7421ef9083ad4',
    },
    'WF-32': {
      id: 'kkAGgnbD8NjWHMKC',
      versionId: '8ad0d3d7-d1a3-40eb-a852-98a19c3f51c6',
      recordHash: '4aaf20ba6b651314b81a94e3f0d1e90ab0a6a8766ea879a81ed6b058f98adc30',
      stagedSourceHash: '31ac22c61ed30990646cf92622ea100cdab7b917bf88392f12a1f90ee32a8a6d',
    },
    'WF-40': {
      id: 'ze8T1o0Cx0OGi3Wd',
      versionId: '47cccb7a-c30a-4ed0-87d5-9af372374364',
      recordHash: '1731ba12b7b158b26bebad4082bfd463b6eeb9f839e0288eaa210e1818622a3a',
      stagedSourceHash: 'b8e14503e7d882f3d9c6afe3d4822c2d2c1fd07d82f451813aca6c71ed581eca',
    },
    'WF-50': {
      id: '2U6nPs3uJkmjij82',
      versionId: '6054e8f3-771b-4325-b7df-5bde7c2211d8',
      recordHash: '97ed3af800ecf37e3c3d1db1f35ea50169cebd3a34ed1469c69ff9032179cf4e',
      stagedSourceHash: '52c3de31fd0fcab0f3f9c158d52d4e50d16c2dd6a7a0a31faa85520459fc3c8b',
    },
    'WF-70': {
      id: 'S6KDFsx5IjQRf6tm',
      versionId: 'd8f518bb-c74b-4158-bbca-8809a652539d',
      recordHash: '9daaa0b94c9ae678720ad1e3c9e143b5b9275d7ecbf144443f996fd2d67c4da9',
      stagedSourceHash: '1149dca0558b68e9f9bc621916222b9b9e98c51f7ce6e038502842ae75dc12c6',
    },
    'WF-80': {
      id: 'gBDmjIIEoM6XC7Wi',
      versionId: 'b250a5be-abb0-4135-9552-a97e1ee065c7',
      recordHash: '94f8412dca7f60db18f4923feb166562ce7208176c3053dcf7a92a4acaa46730',
      stagedSourceHash: '10061be8cb2805dd4239454bcfbb584f0021028595175355680b9f82e9f557b2',
    },
    'WF-00': {
      id: 'MzimjpsuyPuK7SKe',
      versionId: 'b2ff9a94-89b8-4fe2-9bed-093774f0feff',
      recordHash: 'a3d4922364fc414fde9073f98535fef0885443b38fee1d86e5d9a5fe54ed2347',
      stagedSourceHash: '1090db04ecf847c64c28a8bcb247e1080b1db85d37503c1108aa99f307d21239',
    },
    'WF-19': {
      id: 'TsqSMa5MlO3QBLkt',
      versionId: 'a2b8730b-d0d6-4702-aedd-4c8629b81fc0',
      recordHash: '3f43b3e6c21b0a2b275fc606696099936b77835a85a8e74d3a2294515e1263f1',
      stagedSourceHash: '7685254e5fcda84251c254e271e8b241eb5025365e74bdcc86b000315c81287c',
    },
    'WF-90': {
      id: 'S9NHRkKFUIiXX2wv',
      versionId: '2659fdda-1926-4a17-9450-a81098c8e091',
      recordHash: '3408890608fde25078bfefd9785596dcefa6e03a7d0051b476f522f67c26926d',
      stagedSourceHash: '3a5494463416b04fdb86dc409c359d2d8bfa631ac4d2bd90fe6be7d75443b1cc',
    },
    'WF-91': {
      id: 'sowAIvuN7adg0JBq',
      versionId: 'f2440fc9-b206-4632-b9b2-17e165beac40',
      recordHash: '3a76e835ae5b39c7f92f00dd382b2a7e51651bf102f9fce333cb8f3e439e09ea',
      stagedSourceHash: 'ad847803e4c6d1734331efc68641f0638fdc5c87abbf57150a902777a3aca28e',
    },
    'WF-99': {
      id: 'qTjioYmBUVMIERVz',
      versionId: 'cbf1aea5-b5a9-4fcb-91cd-95a86a118e72',
      recordHash: '085564e49c954826da780eed2854ab8122f9d5d6bd7fd2cfb7c8c5005e688116',
      stagedSourceHash: '64fbc43f0226d68709a620b823c641eb4e50740492cc4ee60dde95280ed8441e',
    },
    'SUB-START': {
      id: 'lkVDS0oO4WULipeV',
      versionId: 'a2ec5439-b671-4c68-b4b6-dfb54cb15605',
      recordHash: '59f8cc1fe12a5e81b2ca00af2c7b159f0439ba6b7d76188e3979493ef454bafc',
      stagedSourceHash: '18b9f9b90f0d93cabc527615a6a4da07155e58e4afea2b6d3d178357d6ba418f',
    },
    'SUB-FINISH': {
      id: 'RUTwaXMRh3PgLhJq',
      versionId: '11b75d2f-b4c0-48ce-aae4-6bf7aeb95ab8',
      recordHash: 'f341506c4467d19fb61cbdff08d789011274727b0687846b2a4e0b0ff06b1223',
      stagedSourceHash: '7ee5865556151fc19aab6ad26998ec8bc7d8dcb71f6900f2d7bfddb5b7c41e88',
    },
    'SUB-INGEST': {
      id: 'nDijMP0IurUw58Kg',
      versionId: '983f4040-ea34-4e45-9a95-d19c4ca3e36b',
      recordHash: 'e9871f339f8ec9b4984b1225b66d2c6be903d8e7217cd17537bb0a39c0483056',
      stagedSourceHash: '6b39ecdabf07affd22ca01e433e38bb629aa3db1a0d7341b337a4e1854d89616',
    },
    'SUB-COST': {
      id: 'v4yeqqNm6xHjZ5ue',
      versionId: '21b2e6de-903e-4068-b10b-7b08a55e8dfc',
      recordHash: 'c6b2a71900debe40d76ba45bfa4eb239ea76420f5bf5f129b184fcf632c7d642',
      stagedSourceHash: 'f0e62e3300ac86862c29eb762938c4e860a05e99c25c3e0127ba96c085ed9fdf',
    },
    'SUB-NOTIFY': {
      id: 'tiEhU3dXrMifOnTL',
      versionId: '85cbf9c5-bc29-4c65-a02a-d616b4bd595b',
      recordHash: 'eadb0952ae4fb02c25450ec56e941f28dec124c6501782c211fa15830eb7a112',
      stagedSourceHash: '67dd208e6f495528ab539fde08f1b385fa44f33759346c2819ae6806c4c382ae',
    },
  },
};

// Shared pure comparison only. Importing this module performs no file, secret,
// network or runtime-admission operation. Canonical semantics match the original
// runtime guard; diagnostics never relax those checks or adopt a newer graph.
const graphObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const graphId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const graphFalseDefaults = new Set([
  'disabled',
  'retryOnFail',
  'continueOnFail',
  'executeOnce',
  'alwaysOutputData',
]);
const graphNodeKeys = new Set([
  'id',
  'name',
  'type',
  'typeVersion',
  'parameters',
  'position',
  'credentials',
  'webhookId',
  'notes',
  'notesInFlow',
  'disabled',
  'retryOnFail',
  'onError',
  'continueOnFail',
  'executeOnce',
  'alwaysOutputData',
  'maxTries',
  'waitBetweenTries',
  'extendsCredential',
]);
function graphBlocked() {
  throw Error('FOUNDATION_RUNTIME_CONTROL_BLOCKED');
}
function graphSorted(v) {
  if (Array.isArray(v)) return v.map(graphSorted);
  if (!graphObject(v)) return v;
  return Object.fromEntries(
    Object.keys(v)
      .sort()
      .map((k) => [k, graphSorted(v[k])]),
  );
}
function graphNodes(v) {
  if (!Array.isArray(v) || v.length > 200) graphBlocked();
  return v.map((n) => {
    if (!graphObject(n) || Object.keys(n).some((k) => !graphNodeKeys.has(k))) graphBlocked();
    return Object.fromEntries(
      Object.entries(n).filter(([k, value]) => !(graphFalseDefaults.has(k) && value === false)),
    );
  });
}
const graphCanonical = (v) => JSON.stringify(graphSorted(v));
export function foundationRuntimeGraphHash(body) {
  if (
    !graphObject(body) ||
    typeof body.name !== 'string' ||
    !graphObject(body.settings) ||
    !graphObject(body.connections)
  )
    graphBlocked();
  return createHash('sha256')
    .update(
      graphCanonical({
        name: body.name,
        nodes: graphNodes(body.nodes),
        connections: body.connections,
        settings: body.settings,
      }),
    )
    .digest('hex');
}
export function foundationRuntimePublishedHash(body) {
  return createHash('sha256')
    .update(graphCanonical({ nodes: graphNodes(body.nodes), connections: body.connections }))
    .digest('hex');
}
export const foundationRuntimeBaselineFailureCodes = Object.freeze([
  'expected_shape',
  'dto_shape',
  'workflow_id',
  'archive_state',
  'activation_state',
  'active_version',
  'version_shape',
  'version_mismatch',
  'owner_project',
  'tags_shape',
  'tags_mismatch',
  'pinned_data',
  'graph_shape',
  'node_shape',
  'graph_name',
  'graph_nodes',
  'graph_connections',
  'graph_settings',
]);
export function diagnoseFoundationRuntimeBaseline(dto, baseline, projectId) {
  const failedChecks = [];
  const components = { nameEqual: false, nodesEqual: false, connectionsEqual: false, settingsEqual: false };
  const workflowKey =
    graphObject(baseline) && Object.hasOwn(foundationRuntimeCheckpoint.workflows, baseline.key)
      ? baseline.key
      : 'unknown';
  const done = () =>
    Object.freeze({
      version: 1,
      workflowKey,
      failedChecks: Object.freeze(failedChecks),
      components: Object.freeze(components),
    });
  const check = (ok, code) => {
    if (!ok) failedChecks.push(code);
  };
  try {
    if (
      !graphObject(baseline) ||
      !graphId(baseline.id) ||
      !graphId(baseline.versionId) ||
      !graphId(projectId) ||
      !Array.isArray(baseline.tags)
    ) {
      failedChecks.push('expected_shape');
      return done();
    }
    foundationRuntimeGraphHash(baseline.body);
  } catch {
    failedChecks.push('expected_shape');
    return done();
  }
  if (!graphObject(dto)) {
    failedChecks.push('dto_shape');
    return done();
  }
  try {
    check(dto.id === baseline.id, 'workflow_id');
    check(dto.isArchived === false, 'archive_state');
    check(dto.active === false, 'activation_state');
    check(dto.activeVersionId === null, 'active_version');
    check(graphId(dto.versionId), 'version_shape');
    check(dto.versionId === baseline.versionId, 'version_mismatch');
    check(
      Array.isArray(dto.shared) &&
        dto.shared.some((s) => graphObject(s) && s.projectId === projectId && s.role === 'workflow:owner'),
      'owner_project',
    );
    const tagsValid =
      Array.isArray(dto.tags) &&
      dto.tags.every((t) => graphObject(t) && typeof t.id === 'string' && typeof t.name === 'string');
    check(tagsValid, 'tags_shape');
    if (tagsValid)
      check(
        isDeepStrictEqual(
          graphSorted(
            dto.tags.map((t) => ({ id: t.id, name: t.name })).sort((a, z) => a.id.localeCompare(z.id)),
          ),
          graphSorted([...baseline.tags].sort((a, z) => a.id.localeCompare(z.id))),
        ),
        'tags_mismatch',
      );
    check(
      dto.pinData == null || (graphObject(dto.pinData) && Object.keys(dto.pinData).length === 0),
      'pinned_data',
    );
    const graphValid =
      typeof dto.name === 'string' && graphObject(dto.settings) && graphObject(dto.connections);
    check(graphValid, 'graph_shape');
    components.nameEqual = typeof dto.name === 'string' && dto.name === baseline.body.name;
    try {
      components.nodesEqual =
        graphCanonical(graphNodes(dto.nodes)) === graphCanonical(graphNodes(baseline.body.nodes));
    } catch {
      failedChecks.push('node_shape');
    }
    components.connectionsEqual =
      graphObject(dto.connections) &&
      graphCanonical(dto.connections) === graphCanonical(baseline.body.connections);
    components.settingsEqual =
      graphObject(dto.settings) && graphCanonical(dto.settings) === graphCanonical(baseline.body.settings);
    for (const [name, code] of [
      ['nameEqual', 'graph_name'],
      ['nodesEqual', 'graph_nodes'],
      ['connectionsEqual', 'graph_connections'],
      ['settingsEqual', 'graph_settings'],
    ])
      check(components[name], code);
  } catch {
    if (!failedChecks.includes('dto_shape')) failedChecks.push('dto_shape');
  }
  return done();
}

// Diagnostic profile equality is never provenance, ownership or authority to
// accept/restore an edited version. C01 was a local retention design; its local
// synthetic-state deletion did not establish any Cloud workflow edit/cleanup.
export function diagnoseFoundationRuntimeBaselineVariants(dto, baseline) {
  try {
    if (!graphObject(dto) || baseline?.key !== 'WF-00' || !graphObject(dto.settings)) return null;
    foundationRuntimeGraphHash(baseline.body);
    const actual = graphNodes(dto.nodes),
      wanted = graphNodes(baseline.body.nodes);
    const pick = (v, fields) =>
      Object.fromEntries(fields.filter((k) => Object.hasOwn(v, k)).map((k) => [k, v[k]]));
    const equal = (a, b) => graphCanonical(a) === graphCanonical(b);
    const categories = {
      identity: ['id', 'name', 'type', 'typeVersion'],
      parameters: ['parameters'],
      credentials: ['credentials', 'extendsCredential'],
      behavior: [
        'disabled',
        'retryOnFail',
        'onError',
        'continueOnFail',
        'executeOnce',
        'alwaysOutputData',
        'maxTries',
        'waitBetweenTries',
      ],
      layout: ['position'],
      annotations: ['notes', 'notesInFlow', 'webhookId'],
    };
    const nodeCategories = Object.fromEntries(
      Object.entries(categories).map(([name, fields]) => [
        name + 'Equal',
        equal(
          actual.map((n) => pick(n, fields)),
          wanted.map((n) => pick(n, fields)),
        ),
      ]),
    );
    const retention = [
      'saveDataSuccessExecution',
      'saveDataErrorExecution',
      'saveManualExecutions',
      'saveExecutionProgress',
    ];
    const visibility = ['availableInMCP'],
      routing = ['errorWorkflow'],
      fixed = new Set([...retention, ...visibility, ...routing]);
    const remainder = (v) => Object.fromEntries(Object.entries(v).filter(([k]) => !fixed.has(k)));
    const settings = baseline.body.settings;
    const settingsCategories = {
      retentionEqual: equal(pick(dto.settings, retention), pick(settings, retention)),
      mcpVisibilityEqual: equal(pick(dto.settings, visibility), pick(settings, visibility)),
      errorRoutingEqual: equal(pick(dto.settings, routing), pick(settings, routing)),
      otherEqual: equal(remainder(dto.settings), remainder(settings)),
    };
    // Exact fixed WF00 settings from the reviewed C01 inventory/runtime/case
    // source; none is inferred from the received DTO or its current version.
    const c01 = {
      ...settings,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: true,
      saveExecutionProgress: false,
    };
    const c01Runtime = {
      ...c01,
      availableInMCP: false,
      errorWorkflow: foundationRuntimeCheckpoint.workflows['WF-90'].id,
    };
    const c01Manual = { ...c01Runtime, availableInMCP: true };
    const stagingMcp = { ...settings, availableInMCP: true };
    const stagingManual = { ...c01, availableInMCP: true };
    const disabled = structuredClone(baseline.body.nodes);
    for (const n of disabled) if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
    const schedulesDisabledNodesEqual = equal(actual, graphNodes(disabled));
    const sameNameConnections =
      dto.name === baseline.body.name &&
      graphObject(dto.connections) &&
      equal(dto.connections, baseline.body.connections);
    const knownVariants = {
      c01RetentionSettingsEqual: equal(dto.settings, c01),
      c01RuntimeSettingsEqual: equal(dto.settings, c01Runtime),
      c01ManualSettingsEqual: equal(dto.settings, c01Manual),
      stagingMcpSettingsEqual: equal(dto.settings, stagingMcp),
      stagingManualSettingsEqual: equal(dto.settings, stagingManual),
      schedulesDisabledNodesEqual,
      c01RetentionGraphEqual: sameNameConnections && equal(actual, wanted) && equal(dto.settings, c01),
      stagedManualGraphEqual:
        sameNameConnections && schedulesDisabledNodesEqual && equal(dto.settings, stagingMcp),
      stagedC01ManualGraphEqual:
        sameNameConnections && schedulesDisabledNodesEqual && equal(dto.settings, stagingManual),
    };
    return Object.freeze({
      nodeCategories: Object.freeze(nodeCategories),
      settingsCategories: Object.freeze(settingsCategories),
      knownVariants: Object.freeze(knownVariants),
    });
  } catch {
    return null;
  }
}
