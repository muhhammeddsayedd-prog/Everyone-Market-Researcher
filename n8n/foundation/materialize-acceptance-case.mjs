import { dispatchSlot, scheduledSlots } from '../../packages/shared/src/n8n-schedule.ts';
import { parseHealthInput } from '../../packages/shared/src/n8n-bindings.ts';
import { createApifyRecoveryRuntime } from '../../packages/shared/src/n8n-apify-recovery.ts';
import { buildFoundationGatewayWorkflows } from './build-foundation-gateway.mjs';
import { code, edge, node, nodeId } from './build-foundation.mjs';

// Pure proposed-case source. No credentials, files, network, saves or executions.
// Native Manual Trigger has no generic JSON-input transport. Insert one fixed
// Code node only on its branch instead of inventing tool execution parameters.
const bad = () => {
  throw Error('EMR_FOUNDATION_CASE_INVALID');
};
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) =>
  object(x) && Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const uuid = (x) =>
  typeof x === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const slots = [
  'web_map',
  'vimeo',
  'ig_posts',
  'ig_reels',
  'youtube',
  'li_posts',
  'removal',
  'li_employees',
  'stories_am',
  'linker',
  'news',
  'awards',
  'briefs',
  'digest',
  'health',
];
const healthOperations = { 'health.guard': 1, 'fees.accrue': 1, 'health.read': 1, 'error.log': 3 };
// A conservative union of both callback/recovery visits: each includes the
// mutually-exclusive rejection and atomic branches. No automatic retry/loop is
// licensed. Additional provider webhook deliveries must consume the reserve.
const smokeOperations = {
  'launch.read': 2,
  'run.start': 1,
  'launch.authorize': 1,
  'launch.reconcile': 1,
  'apify.read': 2,
  'apify.terminal.read': 4,
  'apify.dataset.read': 2,
  'apify.process': 2,
  'apify.completion.read': 2,
  'callback.reject': 2,
  'run.finish': 2,
};
const limits = (nativeExecutions, operations = {}, providerGetAttempts = 0, actorStarts = 0) => {
  const businessOperations = Object.values(operations).reduce((a, b) => a + b, 0),
    gatewayHttpAttempts = businessOperations * 2;
  return {
    nativeExecutions,
    businessOperations,
    gatewayHttpAttempts,
    providerGetAttempts,
    actorStarts,
    fixedSqlCommandsUpper: gatewayHttpAttempts * 20,
    operations,
  };
};
const healthInput = () => parseHealthInput({ mode: 'manual', limit: null, result_type: null, env: 'dev' });
function cases() {
  const result = slots.map((slot) => {
    const calls =
      slot === 'awards'
        ? dispatchSlot('news').calls.filter((c) => c.delayMinutes === 30)
        : dispatchSlot(slot).calls.filter((c) => c.delayMinutes === 0);
    return {
      id: 'dispatch.' + slot,
      workflowKey: 'WF-00',
      input: { slot_override: slot, env: 'dev' },
      expectedTargets: calls.map((c) => c.workflow),
      recommendedLive: true,
      upperBounds: slot === 'health' ? limits(8, healthOperations) : limits(2),
    };
  });
  for (const slot of ['stories_pm', 'backfill_wave'])
    result.push({
      id: 'dispatch.' + slot,
      workflowKey: 'WF-00',
      input: { slot_override: slot, env: 'dev' },
      expectedTargets: dispatchSlot(slot).calls.map((c) => c.workflow),
      recommendedLive: false,
      upperBounds: limits(1),
    });
  result.push({
    id: 'dispatch.unknown',
    workflowKey: 'WF-00',
    input: { slot_override: 'm03_unknown_slot', env: 'dev' },
    expectedTargets: ['audit'],
    recommendedLive: true,
    upperBounds: limits(1, { 'error.log': 1 }),
  });
  const timestamp = '2026-12-19T02:00:00Z';
  result.push({
    id: 'dispatch.saturday04',
    workflowKey: 'WF-00',
    input: { timestamp, env: 'dev' },
    expectedTargets: scheduledSlots(timestamp).flatMap((slot) =>
      dispatchSlot(slot).calls.map((c) => c.workflow),
    ),
    recommendedLive: false,
    upperBounds: limits(3),
  });
  for (const ordinal of ['first', 'second']) {
    result.push({
      id: 'health.' + ordinal,
      workflowKey: 'WF-91',
      input: healthInput(),
      expectedTargets: [],
      recommendedLive: ordinal === 'second',
      upperBounds: limits(7, healthOperations),
    });
    result.push({
      id: 'smoke.' + ordinal,
      workflowKey: 'WF-99',
      input: {
        action: 'launch',
        launch_id: nodeId('M03-ACCEPTANCE', 'WF-99 ' + ordinal + ' launch'),
        env: 'dev',
      },
      expectedTargets: [],
      recommendedLive: true,
      requiresFixtureReceipt: true,
      expectedNewItemsMaximum: ordinal === 'first' ? 1 : 0,
      upperBounds: limits(10, smokeOperations, 10, 1),
    });
  }
  for (const [kind, key, operation] of [
    ['ingest', 'SUB-INGEST', 'apify.process'],
    ['cost', 'SUB-COST', 'cost.log'],
  ])
    for (const suffix of ['a', 'b'])
      result.push({
        id: 'sub.' + kind + '.replay_' + suffix,
        workflowKey: key,
        input: null,
        expectedTargets: [],
        recommendedLive: true,
        requiresFixtureReceipt: true,
        requiresFirstRunEvidence: true,
        upperBounds: limits(1, { [operation]: 1 }),
        executionGroup:
          kind === 'ingest'
            ? 'two-original-replays-may-run-concurrently'
            : 'two-original-cost-replays-sequential',
        expectedDeltas: { items: 0, rawSnapshots: 0, queueWork: 0, costRows: 0, costUsd: 0 },
      });
  return result;
}
export function foundationAcceptancePlan() {
  const all = cases(),
    selected = all.filter((c) => c.recommendedLive),
    total = {};
  for (const field of [
    'nativeExecutions',
    'businessOperations',
    'gatewayHttpAttempts',
    'providerGetAttempts',
    'actorStarts',
    'fixedSqlCommandsUpper',
  ])
    total[field] = selected.reduce((sum, c) => sum + c.upperBounds[field], 0);
  return structuredClone({
    sourceOnly: true,
    executionAuthorized: false,
    cases: all,
    recommendedLiveCaseIds: selected.map((c) => c.id),
    totalRecommendedUpperBounds: total,
    countBoundary:
      'Normal-case source upper bounds, including at most two callback/recovery visits per genuine run. Error-trigger cases, forged callbacks, preflight, additional webhook deliveries, management publication and shutdown are separate reserved work; these counts are not provider-enforced quotas.',
    repetitionBoundary:
      'No graph loop or automatic retry is authorized. First and second launch IDs are fixed across rematerialization; ambiguous starts reconcile their original durable admission instead of receiving a new ID.',
    controlPrerequisite:
      'An actual supported native manual-execution control and projected completion readback must be verified separately. A tool that only accepts chat/form/webhook inputs cannot receive arbitrary Manual Trigger JSON. This materializer supplies source only, never MCP access, publication authority or hosted evidence.',
    fixturePrerequisite:
      'Use only the actual committed M03_SMOKE_FIXTURE_READY receipt from the reviewed dev setup. A supplied receipt shape alone does not prove fixture ownership; the existing SQL launch guard must verify it.',
    originalGroupAcquisition: {
      source: 'bounded-original-dataset-read',
      additionalGatewayHttpAttempts: 2,
      additionalProviderGetAttempts: 2,
      caseAllocationIncluded: false,
      authority:
        'Original SQL JSONB group digest is verified by the duplicate process_apify_run call, never recalculated in JavaScript.',
    },
    nativePublicationBoundary: {
      runtimeVersion: '2.43.5',
      directManualChild: 'Loads its saved draft because the direct parent passes executionMode=manual.',
      nestedChild:
        'The child runs integrated; BaseExecuteContext forwards that mode unchanged, so its own Execute Workflow node loads a published definition.',
      uniqueTemporaryWorkflowKeys: ['SUB-NOTIFY', 'WF-90', 'WF-30', 'WF-70', 'WF-80', 'SUB-FINISH', 'WF-19'],
      publicationActions: 8,
      proofBoundary:
        'Pinned source only. Actual supported manual control, saved versions, publication and completion remain unperformed gates. No universal all-children publication rule is assumed.',
    },
    subReadiness: [
      {
        workflowKey: 'SUB-START',
        orderedCases: ['smoke.first', 'smoke.second'],
        nativeCompletionRequired: true,
        emptyExecutionListIsProof: false,
        linkage:
          'Own native SUB execution ID linked to its WF-99 parent; a different workflow succeeding is insufficient.',
        durableReceipts: [
          'run.start original request/status receipt',
          'ops.scrape_runs run ID and original execution_id',
        ],
        expected: 'One distinct parent per genuine launch; unknown acknowledgement reconciles same ID.',
      },
      {
        workflowKey: 'SUB-INGEST',
        orderedCases: ['sub.ingest.replay_a', 'sub.ingest.replay_b'],
        nativeCompletionRequired: true,
        emptyExecutionListIsProof: false,
        linkage:
          'Two actual SUB-INGEST execution IDs, fixed first launch/account; supported terminal evidence is required independently of unchanged SQL counts.',
        durableReceipts: [
          'Original processed apify_run processing_result',
          'Exact SQL groups_sha256 and same measured keyed cost',
          'Unchanged scoped item/raw-snapshot/queue/cost projections',
        ],
        expected:
          'updated=false/finished_now=false; historical items_new/new_item_ids remain original values, with zero new work.',
      },
      {
        workflowKey: 'SUB-COST',
        orderedCases: ['sub.cost.replay_a', 'sub.cost.replay_b'],
        nativeCompletionRequired: true,
        emptyExecutionListIsProof: false,
        linkage:
          'Two actual SUB-COST execution IDs using the original measured keyed-cost entry, no replacement price.',
        durableReceipts: [
          'cost.log original request/status receipts inserted=0',
          'Same original cost key, amount and attribution',
          'Unchanged scoped item/raw-snapshot/queue/cost projections',
        ],
        expected: 'Both inserted=0; no actor or provider call and no fabricated cost.',
      },
      {
        workflowKey: 'SUB-FINISH',
        orderedCases: ['smoke.first', 'smoke.second'],
        nativeCompletionRequired: true,
        emptyExecutionListIsProof: false,
        linkage:
          'Actual SUB-FINISH execution under the verified first callback transition; asynchronous stub starts are not terminal evidence.',
        durableReceipts: [
          'run.finish durable completed summary read',
          'Original processing_result run_summary',
          'Native downstream stub linkage for eligible transition only',
        ],
        expected: 'Original durable summary; duplicate receipt suppresses replacement finish/dispatch.',
      },
      {
        workflowKey: 'SUB-NOTIFY',
        orderedCases: ['dispatch.health', 'health.second', 'automatic-error-threshold'],
        nativeCompletionRequired: true,
        emptyExecutionListIsProof: false,
        linkage:
          'Actual log-only SUB execution from health and third automatic Error Trigger; editor-manual/mock handler is separate.',
        durableReceipts: [
          'notify_logged audit with originating correlation',
          'Third-error atomic six-hour claim and exactly one notify audit',
        ],
        expected: 'sent=false; no external delivery; fourth error adds no notification.',
      },
    ],
    healthCoverage: {
      live: 'Report actual dated known fixed-fee rows and accrued count. Empty/unknown fee coverage proves only safe no-row behavior, not positive hosted accrual.',
      positiveIdempotency:
        'Retain the existing synthetic local SQL fee test; do not invent live fees or reopen the owner questionnaire.',
    },
    publicationOrder: [
      {
        phase: 'bootstrap_notify',
        workflowKeys: ['SUB-NOTIFY'],
        profile: 'staged errorWorkflow omitted; no external notification',
      },
      {
        phase: 'publish_error_handler',
        workflowKeys: ['WF-90'],
        profile: 'published log-only SUB Notify dependency already exists',
      },
      {
        phase: 'install_canonical_error_links',
        workflowKeys: [],
        deferredErrorLinks: 24,
        profile: 'owned IDs only; draft-only PUT publishIfActive=false',
      },
      {
        phase: 'republish_dependency_sources',
        workflowKeys: ['SUB-NOTIFY'],
        profile: 'canonical sources with their verified error link',
      },
      {
        phase: 'publish_nested_stubs',
        workflowKeys: ['WF-30', 'WF-70', 'WF-80'],
        profile:
          'Only nested production-mode dependencies: SUB-FINISH to WF-30/WF-70 and WF-91 to WF-70/WF-80; no recurring schedule.',
      },
      {
        phase: 'publish_remaining_dependencies',
        workflowKeys: ['SUB-FINISH', 'WF-19'],
        profile: 'dependency order; callback publication temporary and separately approved',
      },
      {
        phase: 'manual_case_controls',
        workflowKeys: ['WF-99', 'WF-00', 'WF-91', 'SUB-INGEST', 'SUB-COST'],
        profile:
          'unpublished draft/manual only; one enabled Manual Trigger; ALL Schedule Triggers disabled; NEVER publish WF-00',
      },
    ],
  });
}
function fixtureAccount(value) {
  if (
    !exact(value, [
      'result',
      'company_code',
      'competitor_id',
      'account_id',
      'platform',
      'url',
      'competitor_status',
      'account_status',
    ]) ||
    value.result !== 'M03_SMOKE_FIXTURE_READY' ||
    value.company_code !== 'C999' ||
    !uuid(value.competitor_id) ||
    !uuid(value.account_id) ||
    value.competitor_id === value.account_id ||
    value.platform !== 'website_work_page' ||
    value.url !== 'https://everyone.film/about-everyone' ||
    value.competitor_status !== 'active' ||
    !['active', 'failing'].includes(value.account_status)
  )
    bad();
  return value.account_id;
}
function firstOriginal(value, fixture, windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9') {
  if (
    ![
      'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      'eda4fae1-1e19-47db-81b8-beac1a4ed883',
      '3c46c791-e140-4eb9-890a-eecfa251f65e',
      '4c602549-2c42-4ec3-9328-714d7cb66a77',
      'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
    ].includes(windowId) ||
    !exact(value, ['source', 'readRequestId', 'launch', 'registered', 'atomicInput', 'costEntry']) ||
    value.source !== 'bounded-original-dataset-read' ||
    !uuid(value.readRequestId)
  )
    bad();
  const l = value.launch,
    r = value.registered,
    p = value.atomicInput,
    c = value.costEntry;
  if (
    !exact(l, [
      'window_id',
      'launch_id',
      'ordinal',
      'actor_id',
      'actor_build',
      'run_id',
      'account_id',
      'apify_run_id',
    ]) ||
    l.window_id !== windowId ||
    l.launch_id !== nodeId('M03-ACCEPTANCE', 'WF-99 first launch') ||
    l.ordinal !== 1 ||
    l.actor_id !== 'aYG0l9s7dbB7j3gbS' ||
    l.actor_build !== '0.3.99' ||
    !uuid(l.run_id) ||
    l.account_id !== fixtureAccount(fixture) ||
    typeof l.apify_run_id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(l.apify_run_id)
  )
    bad();
  if (
    !exact(r, [
      'apify_run_id',
      'actor_id',
      'run_id',
      'account_ids',
      'purpose',
      'status',
      'dataset_id',
      'usage_usd',
      'processed_at',
      'processing_result',
    ]) ||
    r.apify_run_id !== l.apify_run_id ||
    r.actor_id !== 'apify/website-content-crawler' ||
    r.run_id !== l.run_id ||
    !Array.isArray(r.account_ids) ||
    r.account_ids.length !== 1 ||
    r.account_ids[0] !== l.account_id ||
    r.status !== 'SUCCEEDED' ||
    r.processed_at === null
  )
    bad();
  const recovery = createApifyRecoveryRuntime(),
    observed = recovery.validateReceipt(r.processing_result, r, p),
    replay = recovery.savedReplay(r, l.apify_run_id);
  if (
    !observed.updated ||
    !observed.finished_now ||
    !replay ||
    replay.status !== 'SUCCEEDED' ||
    replay.items_seen !== 1 ||
    replay.items_new !== 1 ||
    replay.new_item_ids.length !== 1 ||
    p.p_status !== 'SUCCEEDED'
  )
    bad();
  if (
    !exact(c, [
      'provider',
      'category',
      'quantity',
      'unit',
      'cost_usd',
      'run_id',
      'competitor_id',
      'platform',
      'meta',
    ]) ||
    c.provider !== 'apify' ||
    c.category !== 'scrape' ||
    c.quantity !== 1 ||
    c.unit !== 'result' ||
    c.cost_usd !== replay.cost_usd ||
    c.run_id !== l.run_id ||
    c.competitor_id !== fixture.competitor_id ||
    c.platform !== 'website_work_page' ||
    !exact(c.meta, ['actor', 'apify_run_id', 'account_id', 'cost_key']) ||
    c.meta.actor !== 'apify/website-content-crawler' ||
    c.meta.apify_run_id !== l.apify_run_id ||
    c.meta.account_id !== l.account_id ||
    c.meta.cost_key !== replay.cost_keys[0]
  )
    bad();
  return {
    ingest: {
      apify_run_id: p.p_apify_run_id,
      status: p.p_status,
      dataset_id: p.p_dataset_id,
      usage_usd: p.p_usage_usd,
      groups: structuredClone(p.p_groups),
      env: 'dev',
    },
    cost: { entries: [structuredClone(c)], env: 'dev' },
    expectedReplay: replay,
  };
}
const canonical = (value) =>
  Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : object(value)
      ? '{' +
        Object.keys(value)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
          .join(',') +
        '}'
      : JSON.stringify(value);
export function verifyFoundationSubReplay(caseId, output, context, before, after) {
  const spec = cases().find((c) => c.id === caseId);
  if (!spec?.requiresFirstRunEvidence || !exact(context, ['fixtureReceipt', 'firstRunEvidence'])) bad();
  const original = firstOriginal(context.firstRunEvidence, context.fixtureReceipt),
    keys = [
      'items',
      'rawSnapshots',
      'aiExtractQueue',
      'embedQueue',
      'mediaQueue',
      'costEntries',
      'itemsSha256',
      'rawSnapshotsSha256',
      'queuesSha256',
      'costsSha256',
    ];
  for (const state of [before, after])
    if (
      !exact(state, keys) ||
      keys.some((k) =>
        k.endsWith('Sha256')
          ? typeof state[k] !== 'string' || !/^[a-f0-9]{64}$/.test(state[k])
          : !Number.isSafeInteger(state[k]) || state[k] < 0,
      )
    )
      bad();
  if (canonical(before) !== canonical(after)) bad();
  if (spec.workflowKey === 'SUB-INGEST') {
    if (canonical(output) !== canonical(original.expectedReplay)) bad();
  } else if (!exact(output, ['inserted']) || output.inserted !== 0) bad();
  return {
    sourceAssertionsPassed: true,
    hostedAcceptance: false,
    nativeCompletionVerified: false,
    nativeCompletionRequired: true,
    zeroDeltaVerified: true,
    requiredNativeWorkflow: spec.workflowKey,
    caseId,
    payloadEqualityAuthority:
      'Requires the actual native duplicate RPC to accept the original SQL JSONB groups digest; this pure check does not manufacture that proof.',
  };
}
export function materializeFoundationAcceptanceCase(bindings, transport, caseId, options = {}) {
  const spec = cases().find((c) => c.id === caseId);
  if (
    !spec ||
    !object(options) ||
    Object.keys(options).some((k) => !['fixtureReceipt', 'release', 'firstRunEvidence'].includes(k))
  )
    bad();
  const release = Object.hasOwn(options, 'release') ? options.release : { launchEnabled: false };
  if (
    !exact(release, ['launchEnabled']) ||
    typeof release.launchEnabled !== 'boolean' ||
    (spec.workflowKey !== 'WF-99' && release.launchEnabled) ||
    (!spec.requiresFixtureReceipt && Object.hasOwn(options, 'fixtureReceipt')) ||
    (!spec.requiresFirstRunEvidence && Object.hasOwn(options, 'firstRunEvidence'))
  )
    bad();
  let input = structuredClone(spec.input);
  if (spec.workflowKey === 'WF-99') input.account_id = fixtureAccount(options.fixtureReceipt);
  if (spec.requiresFirstRunEvidence) {
    const original = firstOriginal(options.firstRunEvidence, options.fixtureReceipt, transport?.windowId);
    input = spec.workflowKey === 'SUB-INGEST' ? original.ingest : original.cost;
  }
  const graph = buildFoundationGatewayWorkflows(bindings, transport, release).find(
    (g) => g.key === spec.workflowKey,
  );
  if (spec.requiresFirstRunEvidence) {
    const manual = node(spec.workflowKey, 'Manual original replay', 'manualTrigger', {}, [0, 200]);
    graph.workflow.nodes.push(manual);
    graph.workflow.connections[manual.name] = structuredClone(graph.workflow.connections['When called']);
  }
  const manual = graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger');
  if (manual.length !== 1 || graph.workflow.active !== false) bad();
  const source = graph.workflow.connections[manual[0].name];
  if (!exact(source, ['main']) || source.main.length !== 1 || source.main[0].length !== 1) bad();
  const name = 'M03 acceptance input · ' + caseId;
  graph.workflow.nodes.push(
    code(spec.workflowKey, name, 'return [{json:' + JSON.stringify(input) + '}];', [
      manual[0].position[0] + 120,
      manual[0].position[1] + 80,
    ]),
  );
  graph.workflow.connections[name] = structuredClone(source);
  graph.workflow.connections[manual[0].name] = { main: [[edge(name)]] };
  for (const n of graph.workflow.nodes) if (n.type === 'n8n-nodes-base.scheduleTrigger') n.disabled = true;
  const settings = graph.workflow.settings;
  if (
    settings.saveDataErrorExecution !== 'none' ||
    settings.saveDataSuccessExecution !== 'none' ||
    settings.saveManualExecutions !== false ||
    settings.saveExecutionProgress !== false
  )
    bad();
  settings.availableInMCP = true;
  return {
    ...graph,
    kind: 'proposed-native-manual-case',
    hostedAcceptance: false,
    acceptanceCase: {
      ...spec,
      input,
      inputNodeName: name,
      sourceOnly: true,
      executionAuthorized: false,
      actorLaunchEnabled: spec.workflowKey === 'WF-99' && release.launchEnabled,
      fixtureReceiptVerification:
        spec.workflowKey === 'WF-99'
          ? 'shape-only; hosted fixture ownership remains a separate SQL gate'
          : null,
      schedulesEnabled: 0,
    },
  };
}
