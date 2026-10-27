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
  execute,
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

const collectorInputFields = [
  ['mode', 'string'],
  ['limit', 'number'],
  ['result_type', 'string'],
  ['env', 'string'],
  ['max_pages', 'number'],
  ['page_size', 'number'],
  ['results_limit', 'number'],
  ['max_actor_starts', 'number'],
  ['account_ids', 'array'],
];

function errorWorkflowBinding(bindings, workflowId) {
  if (workflowId === undefined) return { key: 'WF-90-M04', state: 'unresolved', reason: 'not_installed' };
  if (
    typeof workflowId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(workflowId) ||
    workflowId === 'M04ErrorHandlerNotInstalled' ||
    Object.values(bindings.workflowRefs).some((r) => r.id === workflowId)
  )
    throw Error('M04_ERROR_WORKFLOW_BINDING_INVALID');
  return { key: 'WF-90-M04', state: 'bound', id: workflowId };
}

function privateSettings(bindings, key, errorWorkflowId) {
  const result = settings(bindings, key);
  delete result.errorWorkflow;
  const binding = errorWorkflowBinding(bindings, errorWorkflowId);
  return {
    ...result,
    ...(binding.state === 'bound' ? { errorWorkflow: binding.id } : {}),
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  };
}

/** Explicit selection is authored into this inactive definition. Trigger input
 * cannot choose another account, mode, workflow ID or independent IG pass. */
export function buildNativeOrchestrator(input, transport, selection, errorWorkflowId) {
  const b = parseN8nBindings(input);
  parseCollectorTransport(transport);
  const key = 'WF-00',
    bad = () => {
      throw Error('M04_ORCHESTRATOR_SELECTION_INVALID');
    };
  if (
    !selection ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    Object.keys(selection).length !== 7 ||
    Object.keys(selection).some(
      (k) =>
        ![
          'mode',
          'vimeo_account_ids',
          'instagram_account_ids',
          'max_pages',
          'page_size',
          'results_limit',
          'max_actor_starts',
        ].includes(k),
    ) ||
    !['daily', 'backfill'].includes(selection.mode) ||
    ['max_pages', 'page_size', 'results_limit', 'max_actor_starts'].some(
      (field) => !Number.isInteger(selection[field]),
    )
  )
    bad();
  const fixed = {};
  for (const kind of ['vimeo', 'instagram']) {
    const accountIds = selection[kind + '_account_ids'];
    if (!Array.isArray(accountIds)) bad();
    const normalized = accountIds.map((id) => (typeof id === 'string' ? id.toLowerCase() : id));
    const collectorInput = {
      mode: selection.mode,
      limit: normalized.length,
      result_type: 'both',
      env: 'dev',
      max_pages: selection.max_pages,
      page_size: selection.page_size,
      results_limit: selection.results_limit,
      max_actor_starts: selection.max_actor_starts,
      account_ids: normalized,
    };
    try {
      runtime.initializeCollector(collectorInput, kind, '1', '2026-10-27T00:00:00Z');
    } catch {
      bad();
    }
    fixed[kind] = collectorInput;
  }
  if (fixed.vimeo.account_ids.some((id) => fixed.instagram.account_ids.includes(id))) bad();
  const nodes = [
    trigger(key, [['env', 'string']]),
    code(key, 'Fixed M04 collector selection', 'return [{json:' + JSON.stringify(fixed) + '}];', [200, 0]),
    ...['vimeo', 'instagram'].map((kind, i) =>
      execute(
        b,
        key,
        kind === 'vimeo' ? 'Collect selected Vimeo accounts' : 'Collect selected Instagram posts and reels',
        kind === 'vimeo' ? 'WF-10' : 'WF-11',
        collectorInputFields,
        Object.fromEntries(
          collectorInputFields.map(([field]) => [
            field,
            `={{ $('Fixed M04 collector selection').first().json.${kind}.${field} }}`,
          ]),
        ),
        true,
        [400 + i * 200, 0],
      ),
    ),
    code(
      key,
      'Return M04 orchestration result',
      `const v=$('Collect selected Vimeo accounts').first().json,i=$input.first().json;return[{json:{env:'dev',vimeo:v,instagram:i}}];`,
      [800, 0],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    errorWorkflowBinding: errorWorkflowBinding(b, errorWorkflowId),
    requiredRefs: {
      workflowKeys: ['WF-10', 'WF-11', 'WF-90-M04'],
      credentialKeys: [],
      tagNames: ['env:dev', 'layer:ops'],
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      connections: line(
        'When called',
        'Fixed M04 collector selection',
        'Collect selected Vimeo accounts',
        'Collect selected Instagram posts and reels',
        'Return M04 orchestration result',
      ),
      settings: privateSettings(b, key, errorWorkflowId),
      tags: tags(b, ['env:dev', 'layer:ops']),
      pinData: {},
    },
    limitations: ['Local fixed-selection wiring only; no native execution or recurring schedule acceptance.'],
  };
}

/** Maintained M04 callback. The closed M03 manual/stub/dispatch definition is
 * historical evidence, never a dependency of this product graph. */
export function buildNativeCallback(input, transport, errorWorkflowId) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = 'WF-19';
  const webhook = {
    id: nodeId(key, 'Apify callback'),
    name: 'Apify callback',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.2,
    parameters: {
      httpMethod: 'POST',
      path: 'emr-apify-callback',
      authentication: 'none',
      responseMode: 'responseNode',
      options: {},
    },
    position: [0, -200],
    webhookId: nodeId(key, 'M04 callback webhook'),
  };
  const response = (name, status, body, position) => ({
    id: nodeId(key, name),
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    parameters: {
      respondWith: 'json',
      responseBody: body,
      options: { responseCode: status, enableStreaming: false },
    },
    position,
  });
  const nodes = [
    webhook,
    trigger(key, [
      ['apify_run_id', 'string'],
      ['env', 'string'],
      ['transport', 'string'],
    ]),
    code(
      key,
      'Validate callback source',
      one +
        `const bad=()=>{throw Error('M04_CALLBACK_INVALID');};
let id,transport;if(Object.hasOwn(j,'body')){const b=j.body;if(!b||typeof b!=='object'||Array.isArray(b)||!['ACTOR.RUN.SUCCEEDED','ACTOR.RUN.FAILED','ACTOR.RUN.TIMED_OUT','ACTOR.RUN.ABORTED'].includes(b.eventType)||!b.resource||typeof b.resource!=='object'||Array.isArray(b.resource))bad();id=b.resource.id;transport='webhook';}
else{if(Object.keys(j).length!==3||Object.keys(j).some(k=>!['apify_run_id','env','transport'].includes(k))||j.env!=='dev'||j.transport!=='recovery')bad();id=j.apify_run_id;transport='recovery';}
if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))bad();return[{json:{apify_run_id:id,transport}}];`,
      [200, 0],
    ),
    code(
      key,
      'Prepare callback classification',
      one +
        runtime.collectorRequestId.toString() +
        `\nreturn[{json:{source:j,request:{version:1,requestId:collectorRequestId(String($execution.id),1),operation:'callback.classify',args:{apify_run_id:j.apify_run_id}}}}];`,
      [400, 0],
    ),
    http(
      c,
      key,
      'Classify registered callback',
      'gateway',
      'POST',
      c.audience + '/api/internal/n8n/collectors',
      [600, 0],
      '={{ $json.request }}',
    ),
    code(
      key,
      'Check callback classification',
      one +
        `const prior=$('Prepare callback classification').item.json,b=j.body;if(j.statusCode!==200||b?.version!==1||b.requestId!==prior.request.requestId||b.operation!=='callback.classify'||!['m04','foundation','unknown'].includes(b.result?.scope))throw Error('M04_CALLBACK_RECONCILIATION_REQUIRED');return[{json:{...prior.source,scope:b.result.scope}}];`,
      [800, 0],
    ),
    booleanIf(key, 'M04 registered callback?', "={{ $json.scope === 'm04' }}", [1000, 0]),
    booleanIf(key, 'Unknown callback webhook?', "={{ $json.transport === 'webhook' }}", [1200, 300]),
    response('Respond unknown callback', 403, '={{ {ok:false,rejected:true} }}', [1400, 200]),
    code(key, 'Unknown callback rejected', `throw Error('M04_UNKNOWN_CALLBACK_REJECTED');`, [1400, 400]),
    code(
      key,
      'Prepare M04 callback processing',
      one +
        runtime.collectorRequestId.toString() +
        `\nconst page=j.pageNumber??0;if(!Number.isInteger(page)||page<0||page>=61)throw Error('M04_CALLBACK_PAGE_BOUND');return[{json:{source:j,pageNumber:page,request:{version:1,requestId:collectorRequestId(String($execution.id),2+page),operation:'callback.process',args:{apify_run_id:j.apify_run_id}}}}];`,
      [1200, -200],
    ),
    http(
      c,
      key,
      'Process verified M04 callback',
      'gateway',
      'POST',
      c.audience + '/api/internal/n8n/collectors',
      [1400, -200],
      '={{ $json.request }}',
      60000,
    ),
    code(
      key,
      'Verify M04 callback receipt',
      one +
        `const prior=$('Prepare M04 callback processing').item.json,b=j.body;if(j.statusCode!==200||b?.version!==1||b.requestId!==prior.request.requestId||b.operation!=='callback.process'||typeof b.replayed!=='boolean'||!b.result||!['pending','completed'].includes(b.result.state))throw Error('M04_CALLBACK_RECONCILIATION_REQUIRED');return[{json:{apify_run_id:prior.source.apify_run_id,pageNumber:prior.pageNumber+1,transport:prior.source.transport,accepted:true,replayed:b.replayed||(b.result.state==='completed'&&b.result.updated===false),completion:b.result,pending:b.result.state==='pending'}}];`,
      [1600, -200],
    ),
    booleanIf(key, 'M04 dataset pages pending?', '={{ $json.pending }}', [1800, -200]),
    booleanIf(key, 'M04 webhook response?', "={{ $json.transport === 'webhook' }}", [2000, 0]),
    response(
      'Respond M04 callback',
      200,
      '={{ {ok:true,accepted:true,replayed:$json.replayed} }}',
      [2200, -100],
    ),
    code(key, 'Return M04 callback result', one + 'return [{json:j}];', [2200, 100]),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    errorWorkflowBinding: errorWorkflowBinding(b, errorWorkflowId),
    requiredRefs: {
      workflowKeys: ['WF-90-M04'],
      credentialKeys: ['foundationGateway'],
      tagNames: ['env:dev', 'layer:ops'],
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      settings: privateSettings(b, key, errorWorkflowId),
      tags: tags(b, ['env:dev', 'layer:ops']),
      pinData: {},
      connections: {
        ...line('Apify callback', 'Validate callback source'),
        ...line('When called', 'Validate callback source'),
        ...line(
          'Validate callback source',
          'Prepare callback classification',
          'Classify registered callback',
          'Check callback classification',
          'M04 registered callback?',
        ),
        'M04 registered callback?': {
          main: [[edge('Prepare M04 callback processing')], [edge('Unknown callback webhook?')]],
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
        'M04 webhook response?': {
          main: [[edge('Respond M04 callback')], [edge('Return M04 callback result')]],
        },
      },
    },
    limitations: [
      'Only registered M04 callbacks are accepted; foundation callbacks remain with their historical workflow.',
      'Local definition only; native webhook delivery remains separate acceptance.',
    ],
  };
}

/** A dedicated M04 error workflow logs a bounded classification only. It never
 * guesses a scrape run, releases claims, retries starts or invokes closed M03. */
export function buildNativeErrorHandler(input, transport, workflowId) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = 'WF-90-M04';
  const sources = Object.fromEntries(['WF-00', 'WF-10', 'WF-11', 'WF-19'].map((k) => [ref(b, k).id, k]));
  const nodes = [
    node(key, 'On M04 workflow error', 'errorTrigger', {}, [0, 0]),
    code(
      key,
      'Prepare classified M04 error',
      one +
        runtime.collectorRequestId.toString() +
        `
const sources=${JSON.stringify(sources)},workflow=j.workflow?.id;
if(typeof workflow!=='string'||!Object.hasOwn(sources,workflow))throw Error('M04_ERROR_SOURCE_INVALID');
const handler=String($execution.id);let execution=j.execution?.id;
if(execution===undefined||execution===null||execution===''){
  if(!j.trigger||typeof j.trigger!=='object'||Array.isArray(j.trigger)||!/^\\d{1,15}$/.test(handler))throw Error('M04_ERROR_CORRELATION_INVALID');
  execution='handler-'+handler;
}else{if(!['string','number'].includes(typeof execution)||!/^\\d{1,15}$/.test(String(execution))||!Number.isSafeInteger(Number(execution)))throw Error('M04_ERROR_CORRELATION_INVALID');execution=String(execution);}
return[{json:{request:{version:1,requestId:collectorRequestId(handler,1),operation:'execution.error',args:{workflow_id:workflow,execution_id:execution,error_code:execution.startsWith('handler-')?'workflow_failed':sources[workflow]==='WF-19'?'callback_retryable':'workflow_failed'}}}}];`,
      [200, 0],
    ),
    http(
      c,
      key,
      'Log classified M04 error',
      'gateway',
      'POST',
      c.audience + '/api/internal/n8n/collectors',
      [400, 0],
      '={{ $json.request }}',
    ),
    code(
      key,
      'Verify M04 error receipt',
      one +
        `const prior=$('Prepare classified M04 error').item.json,b=j.body;
if(j.statusCode!==200||b?.version!==1||b.requestId!==prior.request.requestId||b.operation!=='execution.error'||b.replayed!==false||b.result?.logged!==true||b.result.reconciliation_required!==true)throw Error('M04_ERROR_LOG_UNCONFIRMED');return[{json:{logged:true,reconciliation_required:true}}];`,
      [600, 0],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    errorWorkflowBinding: errorWorkflowBinding(b, workflowId),
    requiredRefs: {
      workflowKeys: [],
      credentialKeys: ['foundationGateway'],
      tagNames: ['env:dev', 'layer:ops'],
    },
    workflow: {
      name: 'WF-90-M04 · Collector error handler [dev]',
      active: false,
      nodes,
      connections: line(
        'On M04 workflow error',
        'Prepare classified M04 error',
        'Log classified M04 error',
        'Verify M04 error receipt',
      ),
      settings: privateSettings(b, key),
      tags: tags(b, ['env:dev', 'layer:ops']),
      pinData: {},
    },
    limitations: [
      ...(workflowId === undefined
        ? [
            'Not installed: generated consumers omit settings.errorWorkflow until a real dedicated M04 workflow ID is explicitly bound.',
          ]
        : []),
      'Logs classification only; reconciliation must preserve actor, claim and parent state.',
      'Native Error Trigger acceptance requires an automatic failure; manual execution cannot prove it.',
    ],
  };
}

export function buildNativeCollector(input, transport, kind, errorWorkflowId) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = kind === 'vimeo' ? 'WF-10' : 'WF-11';
  ref(b, key);
  if (!['vimeo', 'instagram'].includes(kind)) throw Error('M04_COLLECTOR_KIND_INVALID');
  const collectorSettings = privateSettings(b, key, errorWorkflowId);
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
    trigger(key, collectorInputFields),
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
    errorWorkflowBinding: errorWorkflowBinding(b, errorWorkflowId),
    requiredRefs: {
      workflowKeys: ['WF-90-M04'],
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
      ...(errorWorkflowId === undefined
        ? [
            'Dedicated M04 error-handler binding remains unresolved until its actual Cloud ID is explicitly supplied; no closed M03 window is invoked.',
          ]
        : []),
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
export function withManualCollectorEntry(graph, accountIds, bounds) {
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
    (bounds === undefined && accountIds.length !== 2) ||
    accountIds.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id),
    ) ||
    new Set(accountIds.map((id) => id.toLowerCase())).size !== accountIds.length
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
  if (bounds !== undefined) {
    if (
      !bounds ||
      typeof bounds !== 'object' ||
      Array.isArray(bounds) ||
      Object.keys(bounds).length !== 5 ||
      Object.keys(bounds).some(
        (key) => !['mode', 'max_pages', 'page_size', 'results_limit', 'max_actor_starts'].includes(key),
      )
    )
      bad();
    Object.assign(input, bounds, { limit: accountIds.length });
    try {
      runtime.initializeCollector(
        input,
        graph.key === 'WF-10' ? 'vimeo' : 'instagram',
        '1',
        '2026-10-27T00:00:00Z',
      );
    } catch {
      bad();
    }
  }
  const manual = node(graph.key, triggerNodeName, 'manualTrigger', {}, [0, 200]),
    fixed = code(graph.key, inputNodeName, 'return [{json:' + JSON.stringify(input) + '}];', [200, 200]);
  if (original.nodes.some((n) => [manual.id, fixed.id].includes(n.id))) bad();
  result.workflow.nodes.push(manual, fixed);
  Object.assign(result.workflow.connections, line(triggerNodeName, inputNodeName, 'Initialize collector'));
  result.manualEntry = { triggerNodeName, inputNodeName, input };
  return result;
}

/** The orchestrator already embeds its reviewed inputs; a native Manual Trigger
 * only enters that fixed node and cannot supply a selector or workflow ID. */
export function withManualOrchestratorEntry(graph) {
  if (
    !graph ||
    graph.key !== 'WF-00' ||
    graph.kind !== 'native-json-blueprint' ||
    graph.hostedAcceptance !== false ||
    graph.liveEnabled !== false ||
    graph.workflow?.active !== false ||
    graph.workflow.settings?.saveManualExecutions !== false ||
    graph.workflow.settings?.saveDataSuccessExecution !== 'none' ||
    graph.workflow.settings?.saveDataErrorExecution !== 'none' ||
    graph.workflow.settings?.saveExecutionProgress !== false ||
    Object.keys(graph.workflow.pinData ?? {}).length !== 0 ||
    graph.workflow.nodes.filter(
      (n) => n.name === 'Fixed M04 collector selection' && n.type === 'n8n-nodes-base.code',
    ).length !== 1 ||
    graph.workflow.nodes.some((n) =>
      ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.scheduleTrigger'].includes(n.type),
    )
  )
    throw Error('M04_MANUAL_ENTRY_INVALID');
  const result = structuredClone(graph),
    name = 'Manual selected M04 collection';
  result.workflow.nodes.push(node(graph.key, name, 'manualTrigger', {}, [0, 200]));
  Object.assign(result.workflow.connections, line(name, 'Fixed M04 collector selection'));
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
