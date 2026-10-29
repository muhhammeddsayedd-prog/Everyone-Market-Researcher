import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  node,
  trigger,
  settings,
  tags,
  ref,
  edge,
  line,
  booleanIf,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';
import { validateStoryAccounts, buildStoryBatches, storyRegistrationCompletion } from './stories.mjs';
import * as runtime from './native-m06-stories.mjs';

export const m06StoriesCloudSource = [
  validateStoryAccounts,
  buildStoryBatches,
  storyRegistrationCompletion,
  ...Object.values(runtime),
]
  .map((fn) => fn.toString())
  .join('\n\n');
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object')throw Error('M06_STORIES_NATIVE_INPUT_INVALID');const j=rows[0].json;\n";

/** Inactive local product blueprint. No scheduler or historical callback graph is
 * modified; this dispatches asynchronously through the existing restricted route. */
function definition(input, transport, selection, ready) {
  const b = parseN8nBindings(input),
    c = ready ? parseCollectorTransport(transport) : transport,
    key = 'WF-12';
  runtime.initializeM06Stories(selection, '1', '2026-10-29T00:00:00Z');
  const workflowSettings = settings(b, key);
  delete workflowSettings.errorWorkflow;
  Object.assign(workflowSettings, {
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
    availableInMCP: false,
  });
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: b.instanceUrl + '/webhook/emr-m06-stories-callback',
      },
    ]),
    'utf8',
  ).toString('base64');
  const nodes = [
    node(key, 'Manual dev stories check', 'manualTrigger', {}, [0, -200]),
    trigger(key, [['env', 'string']]),
    code(
      key,
      'Initialize fixed stories selection',
      (ready ? '' : "throw Error('M06_STORIES_BINDING_REQUIRED');\n") +
        one +
        m06StoriesCloudSource +
        `\nreturn[{json:initializeM06Stories(${JSON.stringify(selection)},String($execution.id),new Date().toISOString())}];`,
      [200, 0],
    ),
    booleanIf(key, 'Stories gateway action?', "={{ $json.action === 'gateway' }}", [400, 0]),
    code(key, 'Prepare stories gateway', one + 'return[{json:{state:j,request:j.request}}];', [600, -200]),
    nativeM05Http(
      c,
      key,
      'Execute typed stories gateway',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [800, -200],
    ),
    code(
      key,
      'Advance stories gateway',
      one +
        m06StoriesCloudSource +
        "\nconst prior=$('Prepare stories gateway').item.json.state;return[{json:advanceM06StoryGateway(prior,j)}];",
      [1000, -200],
    ),
    booleanIf(key, 'Stories actor action?', "={{ $json.action === 'apify' }}", [600, 200]),
    code(key, 'Prepare stories actor', one + 'return[{json:j}];', [800, 200]),
    nativeM05Http(
      b,
      key,
      'Start asynchronous stories actor',
      'apify',
      '={{ "https://api.apify.com/v2/acts/"+$json.launchDescriptor.actorPath+"/runs?waitForFinish=0&restartOnError=false&timeout="+$json.launchDescriptor.timeout+"&memory="+$json.launchDescriptor.memory+"&build="+encodeURIComponent($json.launchDescriptor.build)+"&maxTotalChargeUsd="+$json.launchDescriptor.maxTotalChargeUsd+"&webhooks=' +
        encodeURIComponent(webhooks) +
        '" }}',
      '={{ $json.batches[$json.batchIndex].input }}',
      [1000, 200],
    ),
    code(
      key,
      'Advance stories actor response',
      one +
        m06StoriesCloudSource +
        "\nconst prior=$('Prepare stories actor').item.json;return[{json:advanceM06StoryActor(prior,j)}];",
      [1200, 200],
    ),
    code(
      key,
      'Return stories dispatch result',
      one +
        "if(j.action!=='done'||!j.result)throw Error('M06_STORIES_NATIVE_STATE_INVALID');return[{json:j.result}];",
      [800, 400],
    ),
  ];
  return {
    key,
    id: ref(b, key).id,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    bindingManifest: { ready, environment: 'dev', audience: c.audience, credential: { ...c.credential } },
    definitionProfile: 'inactive_native_staging',
    sourceProfile: {
      actor: selection.actor_id,
      publicOnly: true,
      inputContract: 'usernames:string[]',
      collectionMode: selection.collection_mode,
    },
    callbackIntegration: {
      state: 'local_server_contract_only',
      requiredNativeChange:
        'route registered instagram_stories callbacks to the M06 gateway; no M05 website branch changes',
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      settings: workflowSettings,
      tags: tags(b, ['env:dev', 'layer:collector', 'platform:instagram_stories']),
      pinData: {},
      connections: {
        ...line('Manual dev stories check', 'Initialize fixed stories selection'),
        ...line('When called', 'Initialize fixed stories selection', 'Stories gateway action?'),
        'Stories gateway action?': {
          main: [[edge('Prepare stories gateway')], [edge('Stories actor action?')]],
        },
        ...line(
          'Prepare stories gateway',
          'Execute typed stories gateway',
          'Advance stories gateway',
          'Stories gateway action?',
        ),
        'Stories actor action?': {
          main: [[edge('Prepare stories actor')], [edge('Return stories dispatch result')]],
        },
        ...line(
          'Prepare stories actor',
          'Start asynchronous stories actor',
          'Advance stories actor response',
          'Stories gateway action?',
        ),
      },
    },
  };
}

export function buildNativeStories(input, transport, selection) {
  return definition(input, transport, selection, true);
}
export function buildUnboundNativeStories(input, selection) {
  return definition(
    input,
    {
      audience: 'https://everyone-market-researcher-unbound.vercel.app',
      credential: { id: 'UNBOUND_EMR_STORIES_AUTH', name: 'UNBOUND EMR stories dev', type: 'httpCustomAuth' },
    },
    selection,
    false,
  );
}
