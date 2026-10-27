import { readFileSync } from 'node:fs';
import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  node,
  nodeId,
  trigger,
  settings,
  tags,
  ref,
  edge,
  line,
  booleanIf,
} from '../foundation/build-foundation.mjs';
import { buildInstagramBatches } from './instagram.mjs';
import * as runtime from './native-runtime.mjs';

const one = `const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object')throw Error('M04_NATIVE_INPUT_INVALID');const j=rows[0].json;\n`;
const functions = Object.values(runtime)
  .map((fn) => fn.toString())
  .join('\n\n');
const normalizerSource = (name) =>
  readFileSync(new URL('../normalizers/' + name + '.js', import.meta.url), 'utf8').split(
    "if (typeof module !== 'undefined')",
  )[0];
export const collectorCloudSource = [
  functions,
  normalizerSource('vimeoApi'),
  normalizerSource('instagramScraper'),
  buildInstagramBatches.toString(),
].join('\n\n');

export function parseCollectorTransport(input) {
  const bad = () => {
    throw Error('M04_TRANSPORT_INVALID');
  };
  if (
    !input ||
    Object.keys(input).some((k) => !['audience', 'credential'].includes(k)) ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(input.audience ?? '') ||
    !input.credential ||
    Object.keys(input.credential).length !== 3 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.credential.id ?? '') ||
    input.credential.name !== 'M03 foundation machine [dev]' ||
    input.credential.type !== 'httpCustomAuth'
  )
    bad();
  return structuredClone(input);
}

function http(
  bindings,
  key,
  name,
  service,
  method,
  url,
  position,
  body,
  timeoutMs = service === 'gateway' ? 25000 : 60000,
) {
  const auth =
    service === 'gateway'
      ? {
          parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth' },
          credentials: { httpCustomAuth: { id: bindings.credential.id, name: bindings.credential.name } },
        }
      : httpCredentialBinding(bindings, service);
  return {
    ...node(
      key,
      name,
      'httpRequest',
      {
        method,
        url,
        ...auth.parameters,
        sendQuery: false,
        sendHeaders: false,
        sendBody: body !== undefined,
        ...(body === undefined ? {} : { specifyBody: 'json', jsonBody: body }),
        options: {
          timeout: timeoutMs,
          allowUnauthorizedCerts: false,
          redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
          sendCredentialsOnCrossOriginRedirect: false,
          response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
        },
      },
      position,
    ),
    credentials: auth.credentials,
    retryOnFail: false,
    onError: 'continueRegularOutput',
  };
}

function nativeWait(key) {
  // Same official-source pinned Wait1.1 contract as the existing callback.
  return {
    id: nodeId(key, 'Wait Vimeo cooldown'),
    name: 'Wait Vimeo cooldown',
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    webhookId: nodeId(key, 'Wait Vimeo cooldown webhook'),
    parameters: { resume: 'timeInterval', amount: '={{ $json.waitSeconds }}', unit: 'seconds' },
    position: [1400, -400],
  };
}

export function buildNativeCollector(input, transport, kind) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = kind === 'vimeo' ? 'WF-10' : 'WF-11';
  ref(b, key);
  ref(b, 'WF-90');
  if (!['vimeo', 'instagram'].includes(kind)) throw Error('M04_COLLECTOR_KIND_INVALID');
  const collectorSettings = settings(b, key);
  const deferredErrorWorkflowId = collectorSettings.errorWorkflow;
  delete collectorSettings.errorWorkflow;
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: b.instanceUrl + '/webhook/emr-apify-callback',
      },
    ]),
    'utf8',
  ).toString('base64');
  const init = code(
    key,
    'Initialize collector',
    collectorCloudSource +
      '\n' +
      one +
      `return[{json:initializeCollector(j,${JSON.stringify(kind)},String($execution.id),new Date().toISOString())}];`,
    [200, 0],
  );
  const prepare = code(
    key,
    'Prepare collector action',
    one +
      `if(!['gateway','vimeo','apify','wait','done'].includes(j.action))throw Error('M04_ACTION_INVALID');return[{json:j}];`,
    [400, 0],
  );
  const gateway = http(
    c,
    key,
    'Restricted collector RPC',
    'gateway',
    'POST',
    c.audience + '/api/internal/n8n/collectors',
    [800, -200],
    '={{ $json.request }}',
  );
  const advance = code(
    key,
    'Advance gateway receipt',
    collectorCloudSource +
      '\n' +
      one +
      `const prior=$('Prepare collector action').item.json;return[{json:advanceCollectorGateway(prior,j,buildInstagramBatches)}];`,
    [1000, -200],
  );
  const provider =
    kind === 'vimeo'
      ? http(b, key, 'Read public Vimeo metadata', 'vimeo', 'GET', '={{ $json.providerUrl }}', [1000, 200])
      : http(
          b,
          key,
          'Start asynchronous Instagram actor',
          'apify',
          'POST',
          '={{ "https://api.apify.com/v2/acts/"+$json.launchDescriptor.actorPath+"/runs?waitForFinish=0&restartOnError=false&timeout="+$json.launchDescriptor.timeout+"&memory=1024&build="+encodeURIComponent($json.launchDescriptor.build)+"&maxItems="+$json.launchDescriptor.maxItems+"&maxTotalChargeUsd="+$json.launchDescriptor.maxTotalChargeUsd+"&webhooks=' +
            encodeURIComponent(webhooks) +
            '" }}',
          [1000, 200],
          '={{ $json.batches[$json.batchIndex].input }}',
        );
  const advanceProvider = code(
    key,
    'Advance provider result',
    collectorCloudSource +
      '\n' +
      one +
      `const prior=$('Prepare collector action').item.json;return[{json:${kind === 'vimeo' ? 'advanceVimeoNative(prior,j,normalizeVimeoApiResult)' : 'advanceInstagramNative(prior,j)'}}];`,
    [1200, 200],
  );
  const nodes = [
    trigger(key, [
      ['mode', 'string'],
      ['limit', 'number'],
      ['result_type', 'string'],
      ['env', 'string'],
      ['max_pages', 'number'],
      ['page_size', 'number'],
      ['results_limit', 'number'],
      ['max_actor_starts', 'number'],
      ['account_ids', 'array'],
    ]),
    init,
    prepare,
    booleanIf(key, 'Collector complete?', "={{ $json.action === 'done' }}", [600, 0]),
    code(
      key,
      'Return collector result',
      one +
        `const terminal=j.request?.operation==='finish'?j.summary:j.summary?.summary;return[{json:{run_id:j.runId,platform:j.kind,mode:j.mode,status:terminal?.status??'awaiting_callbacks',summary:j.summary,actor_starts:j.actorStarts,api_requests:j.calls}}];`,
      [800, -500],
    ),
    booleanIf(key, 'Gateway operation?', "={{ $json.action === 'gateway' }}", [800, 0]),
    gateway,
    advance,
    booleanIf(key, 'Cooldown required?', "={{ $json.action === 'wait' }}", [800, 200]),
    provider,
    advanceProvider,
  ];
  const connections = {
    ...line('When called', 'Initialize collector', 'Prepare collector action', 'Collector complete?'),
    'Collector complete?': { main: [[edge('Return collector result')], [edge('Gateway operation?')]] },
    'Gateway operation?': { main: [[edge('Restricted collector RPC')], [edge('Cooldown required?')]] },
    ...line('Restricted collector RPC', 'Advance gateway receipt', 'Prepare collector action'),
    'Cooldown required?': { main: [[], [edge(provider.name)]] },
    ...line(provider.name, 'Advance provider result', 'Prepare collector action'),
  };
  if (kind === 'vimeo') {
    const fallbackStart = http(
      b,
      key,
      'Start asynchronous Vimeo fallback actor',
      'apify',
      'POST',
      '={{ "https://api.apify.com/v2/acts/"+$json.launchDescriptor.actorPath+"/runs?waitForFinish=0&restartOnError=false&timeout="+$json.launchDescriptor.timeout+"&memory=1024&build="+encodeURIComponent($json.launchDescriptor.build)+"&maxItems="+$json.launchDescriptor.maxItems+"&maxTotalChargeUsd="+$json.launchDescriptor.maxTotalChargeUsd+"&webhooks=' +
        encodeURIComponent(webhooks) +
        '" }}',
      [1000, 600],
      '={{ $json.batches[$json.batchIndex].input }}',
    );
    nodes.push(
      booleanIf(key, 'Vimeo API action?', "={{ $json.action === 'vimeo' }}", [1000, 400]),
      fallbackStart,
      code(
        key,
        'Advance fallback actor result',
        collectorCloudSource +
          '\n' +
          one +
          `const prior=$('Prepare collector action').item.json;return[{json:advanceInstagramNative(prior,j)}];`,
        [1200, 600],
      ),
      nativeWait(key),
      code(
        key,
        'Resume Vimeo request',
        collectorCloudSource + '\n' + one + `return[{json:vimeoNativeRequest(j)}];`,
        [1600, -400],
      ),
    );
    connections['Cooldown required?'].main[0] = [edge('Wait Vimeo cooldown')];
    connections['Cooldown required?'].main[1] = [edge('Vimeo API action?')];
    connections['Vimeo API action?'] = { main: [[edge(provider.name)], [edge(fallbackStart.name)]] };
    Object.assign(
      connections,
      line('Wait Vimeo cooldown', 'Resume Vimeo request', 'Prepare collector action'),
      line(fallbackStart.name, 'Advance fallback actor result', 'Prepare collector action'),
    );
  }
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    deferredErrorWorkflowId,
    requiredRefs: {
      workflowKeys: ['WF-90'],
      credentialKeys:
        kind === 'vimeo' ? ['foundationGateway', 'vimeo', 'apify'] : ['foundationGateway', 'apify'],
      tagNames: ['env:dev', 'layer:collector', 'platform:' + kind],
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      connections,
      settings: {
        ...collectorSettings,
        executionTimeout: 1800,
        saveDataSuccessExecution: 'none',
        saveDataErrorExecution: 'none',
        saveManualExecutions: false,
        saveExecutionProgress: false,
      },
      tags: tags(b, ['env:dev', 'layer:collector', 'platform:' + kind]),
      pinData: {},
    },
    limitations: [
      'Generated code and local database proof do not establish native Cloud or provider acceptance.',
      'No automatic actor POST retries; ambiguous starts require reconciliation.',
      'Global error-handler binding is deferred until WF90 has a compatible M04 logging gateway; no closed M03 window is invoked.',
      ...(kind === 'vimeo'
        ? [
            'Fallback actors require their own explicit approved policy; the representative Instagram-only live policy cannot enable them.',
            'No fallback follows access denial or rate limiting; goat255 never backfills.',
          ]
        : ['Reels backfill exhaustion remains unverified.']),
    ],
  };
}

/** Native Manual Trigger has no JSON input parameter. Attach only the fixed
 * representative selection to an existing collector; this does not save, run,
 * publish or alter the ordinary generated blueprints. */
export function withManualCollectorEntry(graph, accountIds) {
  const bad = () => {
    throw Error('M04_MANUAL_ENTRY_INVALID');
  };
  if (
    !graph ||
    !['WF-10', 'WF-11'].includes(graph.key) ||
    graph.kind !== 'native-json-blueprint' ||
    graph.hostedAcceptance !== false ||
    graph.liveEnabled !== false ||
    !graph.workflow ||
    graph.workflow.active !== false ||
    !Array.isArray(graph.workflow.nodes) ||
    graph.workflow.settings?.saveDataSuccessExecution !== 'none' ||
    graph.workflow.settings?.saveDataErrorExecution !== 'none' ||
    graph.workflow.settings?.saveManualExecutions !== false ||
    graph.workflow.settings?.saveExecutionProgress !== false ||
    Object.keys(graph.workflow.pinData ?? {}).length !== 0 ||
    graph.manualEntry !== undefined ||
    !Array.isArray(accountIds) ||
    accountIds.length !== 2 ||
    accountIds.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id),
    ) ||
    new Set(accountIds.map((id) => id.toLowerCase())).size !== 2
  )
    bad();
  const original = graph.workflow;
  if (
    original.nodes.filter((n) => n.name === 'Initialize collector' && n.type === 'n8n-nodes-base.code')
      .length !== 1 ||
    original.nodes.filter(
      (n) => n.name === 'When called' && n.type === 'n8n-nodes-base.executeWorkflowTrigger',
    ).length !== 1 ||
    original.nodes.some(
      (n) =>
        ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook'].includes(
          n.type,
        ) || ['Manual representative collection', 'Fixed representative selection'].includes(n.name),
    ) ||
    JSON.stringify(original.connections?.['When called']) !==
      JSON.stringify({ main: [[edge('Initialize collector')]] })
  )
    bad();
  const result = structuredClone(graph),
    input = {
      env: 'dev',
      mode: 'backfill',
      limit: 2,
      max_pages: 1,
      page_size: 5,
      results_limit: 5,
      max_actor_starts: 2,
      account_ids: accountIds.map((id) => id.toLowerCase()),
    },
    triggerNodeName = 'Manual representative collection',
    inputNodeName = 'Fixed representative selection';
  const manual = node(graph.key, triggerNodeName, 'manualTrigger', {}, [0, 200]),
    fixed = code(graph.key, inputNodeName, 'return [{json:' + JSON.stringify(input) + '}];', [200, 200]);
  if (original.nodes.some((n) => [manual.id, fixed.id].includes(n.id))) bad();
  result.workflow.nodes.push(manual, fixed);
  Object.assign(result.workflow.connections, line(triggerNodeName, inputNodeName, 'Initialize collector'));
  result.manualEntry = { triggerNodeName, inputNodeName, input };
  return result;
}

/** Preserve every historical foundation node and route only registered M04 IDs
 * into the new trusted server-side processor. No callback-supplied row/cost is
 * forwarded. The existing foundation branch is unchanged byte-for-byte. */
export function extendNativeCallback(input, transport, baseline) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = 'WF-19';
  if (!baseline?.workflow || baseline.key !== key || baseline.id !== ref(b, key).id)
    throw Error('M04_CALLBACK_BASELINE_INVALID');
  const graph = structuredClone(baseline),
    w = graph.workflow;
  const validation = w.nodes.find((n) => n.name === 'Validate callback source');
  if (!validation || !w.connections[validation.name]) throw Error('M04_CALLBACK_BASELINE_INVALID');
  const originalNext = structuredClone(w.connections[validation.name]);
  w.connections[validation.name] = { main: [[edge('Prepare callback classification')]] };
  w.nodes.push(
    code(
      key,
      'Prepare callback classification',
      one +
        `if(!/^[A-Za-z0-9_-]{1,128}$/.test(j.apify_run_id??''))throw Error('M04_CALLBACK_INVALID');const id=String($execution.id);${runtime.collectorRequestId.toString()}return[{json:{source:j,request:{version:1,requestId:collectorRequestId(id,1),operation:'callback.classify',args:{apify_run_id:j.apify_run_id}}}}];`,
      [600, -700],
    ),
    http(
      c,
      key,
      'Classify registered callback',
      'gateway',
      'POST',
      c.audience + '/api/internal/n8n/collectors',
      [800, -700],
      '={{ $json.request }}',
    ),
    code(
      key,
      'Check callback classification',
      one +
        `const prior=$('Prepare callback classification').item.json,b=j.body;if(j.statusCode!==200||b?.version!==1||b.requestId!==prior.request.requestId||b.operation!=='callback.classify'||!['m04','foundation','unknown'].includes(b.result?.scope))throw Error('M04_CALLBACK_RECONCILIATION_REQUIRED');return[{json:{...prior.source,scope:b.result.scope}}];`,
      [1000, -700],
    ),
    booleanIf(key, 'M04 registered callback?', "={{ $json.scope === 'm04' }}", [1200, -700]),
    booleanIf(key, 'Foundation registered callback?', "={{ $json.scope === 'foundation' }}", [1400, -500]),
    booleanIf(key, 'Unknown callback webhook?', "={{ $json.transport === 'webhook' }}", [1600, -500]),
    code(key, 'Unknown callback rejected', `throw Error('M04_UNKNOWN_CALLBACK_REJECTED');`, [1600, -300]),
    code(
      key,
      'Prepare M04 callback processing',
      one +
        runtime.collectorRequestId.toString() +
        `\nconst page=j.pageNumber??0;if(!Number.isInteger(page)||page<0||page>=61)throw Error('M04_CALLBACK_PAGE_BOUND');return[{json:{source:j,pageNumber:page,request:{version:1,requestId:collectorRequestId(String($execution.id),2+page),operation:'callback.process',args:{apify_run_id:j.apify_run_id}}}}];`,
      [1400, -900],
    ),
    http(
      c,
      key,
      'Process verified M04 callback',
      'gateway',
      'POST',
      c.audience + '/api/internal/n8n/collectors',
      [1600, -900],
      '={{ $json.request }}',
      60000,
    ),
    code(
      key,
      'Verify M04 callback receipt',
      one +
        `const prior=$('Prepare M04 callback processing').item.json,b=j.body;if(j.statusCode!==200||b?.version!==1||b.requestId!==prior.request.requestId||b.operation!=='callback.process'||typeof b.replayed!=='boolean'||!b.result||!['pending','completed'].includes(b.result.state))throw Error('M04_CALLBACK_RECONCILIATION_REQUIRED');return[{json:{...prior.source,pageNumber:prior.pageNumber+1,transport:prior.source.transport,accepted:true,replayed:b.replayed||(b.result.state==='completed'&&b.result.updated===false),completion:b.result,pending:b.result.state==='pending'}}];`,
      [1800, -900],
    ),
    booleanIf(key, 'M04 dataset pages pending?', '={{ $json.pending }}', [2000, -1100]),
    booleanIf(key, 'M04 webhook response?', "={{ $json.transport === 'webhook' }}", [2000, -900]),
  );
  const sourceResponse = w.nodes.find((n) => n.type === 'n8n-nodes-base.respondToWebhook');
  if (!sourceResponse) throw Error('M04_CALLBACK_BASELINE_INVALID');
  w.nodes.push({
    ...structuredClone(sourceResponse),
    id: nodeId(key, 'Respond M04 callback'),
    name: 'Respond M04 callback',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ {ok:true,accepted:true,replayed:$json.replayed} }}',
      options: { responseCode: 200, enableStreaming: false },
    },
    position: [2200, -900],
  });
  w.nodes.push({
    ...structuredClone(sourceResponse),
    id: nodeId(key, 'Respond unknown callback'),
    name: 'Respond unknown callback',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ {ok:false,rejected:true} }}',
      options: { responseCode: 403, enableStreaming: false },
    },
    position: [1800, -500],
  });
  Object.assign(
    w.connections,
    line(
      'Prepare callback classification',
      'Classify registered callback',
      'Check callback classification',
      'M04 registered callback?',
    ),
    {
      'M04 registered callback?': {
        main: [[edge('Prepare M04 callback processing')], [edge('Foundation registered callback?')]],
      },
      'Foundation registered callback?': {
        main: [originalNext.main[0], [edge('Unknown callback webhook?')]],
      },
      'Unknown callback webhook?': {
        main: [[edge('Respond unknown callback')], [edge('Unknown callback rejected')]],
      },
      ...line(
        'Prepare M04 callback processing',
        'Process verified M04 callback',
        'Verify M04 callback receipt',
        'M04 dataset pages pending?',
      ),
      'M04 dataset pages pending?': {
        main: [[edge('Prepare M04 callback processing')], [edge('M04 webhook response?')]],
      },
      'M04 webhook response?': { main: [[edge('Respond M04 callback')], []] },
    },
  );
  w.active = false;
  w.pinData = {};
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    workflow: w,
    preservedFoundationNodeCount: baseline.workflow.nodes.length,
    preservedFoundationSavedVersion: baseline.versionId,
    requiredRefs: { workflowKeys: ['WF-90'], credentialKeys: ['foundationGateway'], tagNames: [] },
  };
}
