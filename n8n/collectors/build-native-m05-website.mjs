import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  node,
  trigger,
  settings,
  tags,
  ref,
  line,
  edge,
  booleanIf,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';
import { m05Gateway, m05RequestId } from './native-m05-runtime.mjs';
import {
  websiteMapBody,
  websiteMapLimit,
  websiteSourceOptions,
  selectWebsitePending,
  websiteCrawlerInput,
  parseWebsiteMapResponse,
  buildWebsiteCrawlerBatches,
} from './website.mjs';
import * as runtime from './native-m05-website.mjs';

const pureAliases = `const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);const bad=()=>{throw Error('website_source_contract_invalid');};
const canonicalOwnedWebsiteUrl=m05WebsiteCanonical,websiteAccountScope=m05WebsiteScope,ownsWebsiteUrl=m05WebsiteOwns,isWebsiteProjectUrl=m05WebsiteProject;\n`;
export const m05WebsiteCloudSource =
  [
    m05RequestId,
    m05Gateway,
    websiteMapBody,
    websiteMapLimit,
    websiteSourceOptions,
    selectWebsitePending,
    websiteCrawlerInput,
    parseWebsiteMapResponse,
    buildWebsiteCrawlerBatches,
    ...Object.values(runtime),
  ]
    .map((fn) => fn.toString())
    .join('\n\n') +
  '\n' +
  pureAliases;
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object')throw Error('M05_NATIVE_INPUT_INVALID');const j=rows[0].json;\n";

function websiteFirecrawlBinding(value, bindings) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).sort().join(',') !== 'environment,id,name,type' ||
    value.type !== 'httpHeaderAuth' ||
    value.environment !== 'dev' ||
    !/^[A-Za-z\d_-]{1,128}$/.test(value.id ?? '') ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(value.name) ||
    Object.values(bindings.credentials ?? {}).some((c) => c.id === value.id)
  )
    throw Error('M05_FIRECRAWL_BINDING_INVALID');
  return value;
}

/** Inactive blueprint only. Missing Firecrawl metadata produces an explicit
 * blocking guard, never a fabricated credential, live request or silent fallback.
 */
export function buildNativeWebsite(input, transport, selection, firecrawl) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = 'WF-21';
  runtime.initializeM05Website(selection, '1', '2026-10-28T00:00:00Z');
  const workflowSettings = settings(b, key);
  delete workflowSettings.errorWorkflow;
  Object.assign(workflowSettings, {
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  });
  const base = {
    key,
    id: ref(b, key).id,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    sourceProfile: {
      provider: 'firecrawl-map-and-apify-website',
      publicOnly: true,
      discoveryCoverage: 'observed_map_only',
      thinRetry: 'WF19_registered_one_time_adaptive_barrier',
    },
    errorWorkflowBinding: { state: 'unresolved', reason: 'M05_handler_publication_not_authorized' },
    requiredRefs: {
      workflowKeys: ['WF-21', 'WF-19'],
      credentialKeys: ['firecrawl', 'apify', 'foundationGateway'],
      tagNames: ['env:dev', 'layer:collector', 'platform:website_work_page'],
    },
  };
  const workflow = {
    name: ref(b, key).name,
    active: false,
    settings: workflowSettings,
    tags: tags(b, base.requiredRefs.tagNames),
    pinData: {},
  };
  if (firecrawl === undefined)
    return {
      ...base,
      runnableWorkflow: false,
      bindingState: 'Firecrawl_metadata_required',
      workflow: {
        ...workflow,
        nodes: [
          trigger(key, [['env', 'string']]),
          code(key, 'Firecrawl binding required', "throw Error('M05_FIRECRAWL_BINDING_REQUIRED');", [200, 0]),
        ],
        connections: line('When called', 'Firecrawl binding required'),
      },
    };
  const f = websiteFirecrawlBinding(firecrawl, b);
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: b.instanceUrl + '/webhook/emr-apify-callback',
      },
    ]),
    'utf8',
  ).toString('base64');
  const map = {
    ...node(
      key,
      'Map owned website',
      'httpRequest',
      {
        method: 'POST',
        url: 'https://api.firecrawl.dev/v2/map',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendQuery: false,
        sendHeaders: false,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ $json.http.body }}',
        options: {
          timeout: 65000,
          allowUnauthorizedCerts: false,
          redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
          sendCredentialsOnCrossOriginRedirect: false,
          response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
        },
      },
      [1000, 100],
    ),
    credentials: { httpHeaderAuth: { id: f.id, name: f.name } },
    retryOnFail: false,
    onError: 'continueRegularOutput',
  };
  const actorUrl =
    '={{ "https://api.apify.com/v2/acts/"+$json.actor.descriptor.actorPath+"/runs?waitForFinish=0&restartOnError=false&timeout=600&memory=1024&build="+encodeURIComponent($json.actor.descriptor.build)+"&maxTotalChargeUsd="+$json.actor.descriptor.maxTotalChargeUsd+"&webhooks=' +
    encodeURIComponent(webhooks) +
    '" }}';
  const nodes = [
    trigger(key, [['env', 'string']]),
    code(
      key,
      'Initialize fixed website selection',
      one +
        m05WebsiteCloudSource +
        `\nreturn[{json:initializeM05Website(${JSON.stringify(selection)},String($execution.id),new Date().toISOString())}];`,
      [200, 0],
    ),
    booleanIf(key, 'Website gateway action?', "={{ $json.action === 'gateway' }}", [400, 0]),
    code(key, 'Prepare website gateway', one + 'return[{json:{state:j,request:j.request}}];', [600, -200]),
    nativeM05Http(
      c,
      key,
      'Execute typed website gateway',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [800, -200],
    ),
    code(
      key,
      'Advance website gateway',
      one +
        m05WebsiteCloudSource +
        "\nconst state=$('Prepare website gateway').item.json.state;return[{json:advanceM05WebsiteGateway(state,j)}];",
      [1000, -200],
    ),
    booleanIf(key, 'Website map action?', "={{ $json.action === 'map' }}", [600, 200]),
    code(key, 'Prepare website map', one + 'return[{json:{state:j,http:j.http}}];', [800, 100]),
    map,
    code(
      key,
      'Advance website map',
      one +
        m05WebsiteCloudSource +
        "\nconst state=$('Prepare website map').item.json.state;return[{json:advanceM05WebsiteMap(state,j)}];",
      [1200, 100],
    ),
    booleanIf(key, 'Website actor action?', "={{ $json.action === 'apify' }}", [800, 400]),
    code(key, 'Prepare website actor', one + 'return[{json:{state:j,actor:j.actor}}];', [1000, 300]),
    nativeM05Http(
      b,
      key,
      'Start approved website actor',
      'apify',
      actorUrl,
      '={{ $json.actor.input }}',
      [1200, 300],
    ),
    code(
      key,
      'Advance website actor',
      one +
        m05WebsiteCloudSource +
        "\nconst state=$('Prepare website actor').item.json.state;return[{json:advanceM05WebsiteActor(state,j)}];",
      [1400, 300],
    ),
    code(
      key,
      'Return website collector result',
      one +
        "if(j.action!=='done'||!j.result)throw Error('M05_NATIVE_STATE_INVALID');return[{json:j.result}];",
      [1000, 600],
    ),
  ];
  return {
    ...base,
    runnableWorkflow: true,
    bindingState: 'metadata_bound_not_endpoint_verified',
    workflow: {
      ...workflow,
      nodes,
      connections: {
        ...line('When called', 'Initialize fixed website selection', 'Website gateway action?'),
        'Website gateway action?': {
          main: [[edge('Prepare website gateway')], [edge('Website map action?')]],
        },
        ...line(
          'Prepare website gateway',
          'Execute typed website gateway',
          'Advance website gateway',
          'Website gateway action?',
        ),
        'Website map action?': { main: [[edge('Prepare website map')], [edge('Website actor action?')]] },
        ...line('Prepare website map', 'Map owned website', 'Advance website map', 'Website gateway action?'),
        'Website actor action?': {
          main: [[edge('Prepare website actor')], [edge('Return website collector result')]],
        },
        ...line(
          'Prepare website actor',
          'Start approved website actor',
          'Advance website actor',
          'Website gateway action?',
        ),
      },
    },
  };
}
