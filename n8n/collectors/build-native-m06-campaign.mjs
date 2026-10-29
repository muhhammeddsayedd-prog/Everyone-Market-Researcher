import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  node,
  code,
  booleanIf,
  line,
  edge,
  execute,
  settings,
  tags,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';
import { m06StoriesCloudSource } from './build-native-m06-stories.mjs';
import * as runtime from './native-m06-campaign.mjs';
import { advanceM06StoryMediaHandoff } from './m06-story-media-handoff.mjs';

const one =
  "const r=$input.all();if(r.length!==1||!r[0].json||typeof r[0].json!=='object'||Array.isArray(r[0].json)||r[0].binary)throw Error('M06_CAMPAIGN_INPUT_INVALID');const j=r[0].json;\n";
export const m06CampaignCloudSource =
  m06StoriesCloudSource +
  '\n' +
  Object.values(runtime)
    .map((f) => f.toString())
    .join('\n\n');

/** Calendar rules for seven observation days and one recovery day, plus a year-aware local guard and the SQL
 * cutoff. Publication is required by native ScheduleTrigger1.4. Cleanup of the
 * published workflow/credentials is separate from refusing further starts.
 * https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/
 * https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts */
export function m06CampaignCron(pin) {
  runtime.validateM06CampaignPin(pin);
  const months = new Map();
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.parse(pin.start_date) + i * 86400000);
    const month = d.getUTCMonth() + 1;
    const days = months.get(month) ?? [];
    days.push(d.getUTCDate());
    months.set(month, days);
  }
  return [...months].map(([month, days]) => ({
    field: 'cronExpression',
    expression: `0 */5 6-17 ${days.length === 1 ? days[0] : `${days[0]}-${days.at(-1)}`} ${month} *`,
  }));
}

function definition(input, transport, pin, workflows, ready) {
  runtime.validateM06CampaignPin(pin);
  if (
    !workflows ||
    Object.keys(workflows).sort().join(',') !== 'callback,collector,media' ||
    Object.values(workflows).some(
      (v) =>
        typeof v !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(v) ||
        (ready && /(?:unbound|placeholder)/i.test(v)),
    ) ||
    new Set(Object.values(workflows)).size !== 3
  )
    throw Error('M06_CAMPAIGN_BINDING_REQUIRED');
  const b = parseN8nBindings(input),
    c = ready ? parseCollectorTransport(transport) : transport,
    key = 'WF-12-CAMPAIGN';
  b.workflowRefs['WF-12'] = { ...b.workflowRefs['WF-12'], id: workflows.collector };
  b.workflowRefs['WF-19'] = { ...b.workflowRefs['WF-19'], id: workflows.callback };
  b.workflowRefs['WF-31'] = { ...b.workflowRefs['WF-31'], id: workflows.media };
  const privacy = settings(b, 'WF-12');
  delete privacy.errorWorkflow;
  Object.assign(privacy, {
    executionTimeout: 2400,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
    availableInMCP: false,
  });
  const launch = execute(b, key, 'Dispatch one claimed story group', 'WF-12', [], {}, true, [1400, -300]);
  delete launch.parameters.workflowInputs;
  const callback = execute(
    b,
    key,
    'Reconcile known story callback',
    'WF-19',
    [
      ['apify_run_id', 'string'],
      ['env', 'string'],
      ['transport', 'string'],
    ],
    { apify_run_id: '={{ $json.apify_run_id }}', env: 'dev', transport: 'recovery' },
    true,
    [1400, 0],
  );
  const media = execute(b, key, 'Reconcile one story media batch', 'WF-31', [], {}, true, [1600, 300]);
  delete media.parameters.workflowInputs;
  for (const n of [launch, callback, media]) {
    n.retryOnFail = false;
    n.onError = 'stopWorkflow';
  }
  const nodes = [
    node(
      key,
      'Seven-day dev story slots',
      'scheduleTrigger',
      { rule: { interval: m06CampaignCron(pin) } },
      [0, 0],
    ),
    code(
      key,
      'Guard finite campaign',
      (ready ? '' : "throw Error('M06_CAMPAIGN_BINDING_REQUIRED');\n") +
        one +
        m06CampaignCloudSource +
        `\nreturn[{json:prepareM06CampaignTick(${JSON.stringify(pin)},String($execution.id),new Date().toISOString())}];`,
      [200, 0],
    ),
    booleanIf(key, 'Campaign tick required?', '={{ $json.action === "gateway" }}', [400, 0]),
    code(key, 'Prepare campaign tick', one + 'return[{json:j}];', [600, -150]),
    nativeM05Http(
      c,
      key,
      'Admit next campaign operation',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [800, -150],
    ),
    code(
      key,
      'Verify claimed campaign operation',
      one +
        m06CampaignCloudSource +
        `\nreturn[{json:verifyM06CampaignTick(j,$('Prepare campaign tick').item.json,${JSON.stringify(pin)})}];`,
      [1000, -150],
    ),
    booleanIf(key, 'Launch claimed group?', '={{ $json.action === "launch" }}', [1200, -150]),
    launch,
    code(
      key,
      'Verify one story dispatch',
      one +
        "if(!['awaiting_callbacks','completed'].includes(j.state)||j.registration_closed!==true||j.actor_starts!==1||!Array.isArray(j.actor_run_ids)||j.actor_run_ids.length!==1)throw Error('M06_CAMPAIGN_DISPATCH_UNCERTAIN');return[{json:{action:'done',state:j.state,actor_run_ids:j.actor_run_ids}}];",
      [1600, -300],
    ),
    booleanIf(key, 'Recover known callback?', '={{ $json.action === "recover" }}', [1200, 0]),
    callback,
    code(
      key,
      'Prepare recovery registration close',
      one +
        m06CampaignCloudSource +
        "\nreturn[{json:prepareM06CampaignRecoveryClose(j,$('Recover known callback?').item.json,String($execution.id))}];",
      [1600, 0],
    ),
    booleanIf(key, 'Close recovered registration?', '={{ $json.action === "gateway" }}', [1800, 0]),
    code(key, 'Prepare recovered close request', one + 'return[{json:j}];', [2000, -100]),
    nativeM05Http(
      c,
      key,
      'Close recovered registration',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [2200, -100],
    ),
    code(
      key,
      'Verify recovered registration',
      one +
        m06CampaignCloudSource +
        "\nreturn[{json:verifyM06CampaignRecoveryClose(j,$('Prepare recovered close request').item.json)}];",
      [2400, -100],
    ),
    booleanIf(key, 'Recover story media?', '={{ $json.action === "media" }}', [1200, 200]),
    code(
      key,
      'Prepare finite story media recovery',
      one +
        "if(j.action!=='media'||j.max_batches!==6)throw Error('M06_CAMPAIGN_MEDIA_INVALID');return[{json:{action:'execute',remaining:6,batches:0,itemsNew:0}}];",
      [1400, 300],
    ),
    booleanIf(key, 'More story media recovery?', '={{ $json.action === "execute" }}', [1600, 500]),
    code(
      key,
      'Prepare empty story recovery input',
      one +
        "if(j.action!=='execute')throw Error('M06_CAMPAIGN_MEDIA_INVALID');return[{json:{},pairedItem:{item:0}}];",
      [1800, 300],
    ),
    media,
    code(
      key,
      'Verify recovered story media',
      one +
        advanceM06StoryMediaHandoff.toString() +
        "\nreturn[{json:advanceM06StoryMediaHandoff($('More story media recovery?').item.json,j)}];",
      [2000, 300],
    ),
    code(
      key,
      'Return finite campaign operation',
      one + "if(j.action==='blocked')throw Error('M06_CAMPAIGN_RECONCILIATION_REQUIRED');return[{json:j}];",
      [2600, 500],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    runnableWorkflow: true,
    hostedAcceptance: false,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    campaign: {
      ...pin,
      timezone: 'Africa/Cairo',
      freshStartHours: [6, 12],
      recoveryHours: [6, 18],
      maxMediaBatches: 6,
      cutoff: 'calendar_rules_and_native_guard_plus_authoritative_SQL_launch_fence',
      cleanup: 'separate_owned_resource_shutdown',
    },
    bindingManifest: {
      ready,
      environment: 'dev',
      audience: c.audience,
      credential: { ...c.credential },
      workflows: { ...workflows },
    },
    workflow: {
      name: 'WF-12-M06 · Seven-day story comparison [dev]',
      active: false,
      nodes,
      settings: privacy,
      tags: tags(b, ['env:dev', 'layer:collector', 'platform:instagram_stories']),
      pinData: {},
      connections: {
        ...line('Seven-day dev story slots', 'Guard finite campaign', 'Campaign tick required?'),
        'Campaign tick required?': {
          main: [[edge('Prepare campaign tick')], [edge('Return finite campaign operation')]],
        },
        ...line(
          'Prepare campaign tick',
          'Admit next campaign operation',
          'Verify claimed campaign operation',
          'Launch claimed group?',
        ),
        'Launch claimed group?': {
          main: [[edge('Dispatch one claimed story group')], [edge('Recover known callback?')]],
        },
        ...line(
          'Dispatch one claimed story group',
          'Verify one story dispatch',
          'Return finite campaign operation',
        ),
        'Recover known callback?': {
          main: [[edge('Reconcile known story callback')], [edge('Recover story media?')]],
        },
        ...line(
          'Reconcile known story callback',
          'Prepare recovery registration close',
          'Close recovered registration?',
        ),
        'Close recovered registration?': {
          main: [[edge('Prepare recovered close request')], [edge('Return finite campaign operation')]],
        },
        ...line(
          'Prepare recovered close request',
          'Close recovered registration',
          'Verify recovered registration',
          'Return finite campaign operation',
        ),
        'Recover story media?': {
          main: [[edge('Prepare finite story media recovery')], [edge('Return finite campaign operation')]],
        },
        ...line('Prepare finite story media recovery', 'More story media recovery?'),
        'More story media recovery?': {
          main: [[edge('Prepare empty story recovery input')], [edge('Return finite campaign operation')]],
        },
        ...line(
          'Prepare empty story recovery input',
          'Reconcile one story media batch',
          'Verify recovered story media',
          'More story media recovery?',
        ),
      },
    },
  };
}

export function buildNativeM06Campaign(input, transport, pin, workflows) {
  return definition(input, transport, pin, workflows, true);
}

export function buildUnboundNativeM06Campaign(input) {
  const pin = {
    campaign_id: '63000000-0000-4000-8000-000000000001',
    start_date: '2026-10-31',
    end_date: '2026-11-06',
    account_ids: Array.from(
      { length: 20 },
      (_, i) => `63000000-0000-4000-8000-${(i + 100).toString(16).padStart(12, '0')}`,
    ),
  };
  const output = definition(
    input,
    {
      audience: 'https://everyone-market-researcher-unbound.vercel.app',
      credential: {
        id: 'UNBOUND_EMR_CAMPAIGN_AUTH',
        name: 'UNBOUND EMR campaign dev',
        type: 'httpCustomAuth',
      },
    },
    pin,
    {
      collector: 'UNBOUND_EMR_CAMPAIGN_COLLECTOR',
      callback: 'UNBOUND_EMR_CAMPAIGN_CALLBACK',
      media: 'UNBOUND_EMR_CAMPAIGN_MEDIA',
    },
    false,
  );
  output.fixture = {
    synthetic: true,
    description:
      'Synthetic roster and calendar illustrate native shape only; runtime guard refuses every execution before I/O.',
  };
  return output;
}
