import { dispatchSlot, scheduledSlots } from '../../packages/shared/src/n8n-schedule.ts';
import { parseHealthInput } from '../../packages/shared/src/n8n-bindings.ts';
import { buildFoundationGatewayWorkflows } from './build-foundation-gateway.mjs';
import { code, edge, nodeId } from './build-foundation.mjs';

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
        workflowKeys: ['SUB-NOTIFY', 'SUB-START', 'SUB-COST', 'SUB-INGEST'],
        profile: 'canonical sources with their verified error link',
      },
      {
        phase: 'publish_explicit_stubs',
        workflowKeys: [
          'WF-10',
          'WF-11',
          'WF-12',
          'WF-13',
          'WF-18',
          'WF-18b',
          'WF-21',
          'WF-22',
          'WF-23',
          'WF-30',
          'WF-32',
          'WF-40',
          'WF-50',
          'WF-70',
          'WF-80',
        ],
        profile: 'stubs only; no recurring schedule',
      },
      {
        phase: 'publish_remaining_dependencies',
        workflowKeys: ['SUB-FINISH', 'WF-91', 'WF-19'],
        profile: 'dependency order; callback publication temporary and separately approved',
      },
      {
        phase: 'manual_case_controls',
        workflowKeys: ['WF-99', 'WF-00'],
        profile: 'reviewed manual case variant; ALL Schedule Triggers disabled; no recurring activation',
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
export function materializeFoundationAcceptanceCase(bindings, transport, caseId, options = {}) {
  const spec = cases().find((c) => c.id === caseId);
  if (
    !spec ||
    !object(options) ||
    Object.keys(options).some((k) => !['fixtureReceipt', 'release'].includes(k))
  )
    bad();
  const release = Object.hasOwn(options, 'release') ? options.release : { launchEnabled: false };
  if (
    !exact(release, ['launchEnabled']) ||
    typeof release.launchEnabled !== 'boolean' ||
    (spec.workflowKey !== 'WF-99' && (release.launchEnabled || Object.hasOwn(options, 'fixtureReceipt')))
  )
    bad();
  const input = structuredClone(spec.input);
  if (spec.workflowKey === 'WF-99') input.account_id = fixtureAccount(options.fixtureReceipt);
  const graph = buildFoundationGatewayWorkflows(bindings, transport, release).find(
    (g) => g.key === spec.workflowKey,
  );
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
