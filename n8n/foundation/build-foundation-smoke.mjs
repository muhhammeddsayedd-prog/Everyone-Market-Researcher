import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { blueprint, code, node, trigger, execute, booleanIf, edge, line } from './build-foundation.mjs';
import { gatewayOperationNodes, compileFoundationGateway } from './build-foundation-gateway.mjs';

export const foundationSmokeInput = Object.freeze({
  startUrls: [{ url: 'https://everyone.film/about-everyone' }],
  crawlerType: 'cheerio',
  maxCrawlDepth: 0,
  maxCrawlPages: 1,
  saveMarkdown: true,
  proxyConfiguration: { useApifyProxy: true },
  saveFiles: false,
  saveContentTypes: '',
  summarize: false,
  useSitemaps: false,
  useLlmsTxt: false,
  maxRequestRetries: 0,
  maxSessionRotations: 0,
  maxResults: 1,
  maxConcurrency: 1,
  ignoreHttpsErrors: false,
  respectRobotsTxtFile: true,
});
const one = `const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object'||Array.isArray(rows[0].json))throw Error('EMR_FOUNDATION_SMOKE_INPUT_INVALID');const j=rows[0].json;\n`;
const uuid = `const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);\n`;
/** Functional async launch, disabled in every generated source artifact. */
export function buildFoundationSmoke(input, transport, release = { launchEnabled: false }) {
  if (!release || Object.keys(release).length !== 1 || typeof release.launchEnabled !== 'boolean')
    throw Error('EMR_FOUNDATION_RELEASE_INVALID');
  const b = parseN8nBindings(input),
    key = 'WF-99',
    auth = httpCredentialBinding(b, 'apify');
  const nodes = [
    node(key, 'Manual foundation smoke', 'manualTrigger', {}, [0, 100]),
    trigger(key, [
      ['action', 'string'],
      ['launch_id', 'string'],
      ['account_id', 'string'],
      ['apify_run_id', 'string'],
      ['env', 'string'],
    ]),
    code(
      key,
      'Validate smoke action',
      one +
        uuid +
        `if(Object.keys(j).some(k=>!['action','launch_id','account_id','apify_run_id','env'].includes(k))||(j.env!==undefined&&j.env!=='dev'))throw Error('EMR_FOUNDATION_SMOKE_INPUT_INVALID');
if(j.action===undefined)return[{json:{action:'blocked',launchEnabled:false,reason:'separate_foundation_acceptance_approval_required'}}];
if(!['launch','recover'].includes(j.action)||!uuid(j.launch_id)||(j.action==='launch'&&!uuid(j.account_id))||(j.action==='recover'&&(typeof j.apify_run_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(j.apify_run_id))))throw Error('EMR_FOUNDATION_SMOKE_INPUT_INVALID');
return[{json:{action:j.action,launch_id:j.launch_id,account_id:j.account_id??null,apify_run_id:j.apify_run_id??null,launchEnabled:${JSON.stringify(release.launchEnabled)},params:[j.launch_id]}}];`,
      [240, 0],
    ),
    booleanIf(key, 'Launch requested?', "={{ $json.action === 'launch' }}", [480, 0]),
    booleanIf(key, 'Approved launch gate (disabled)?', '={{ $json.launchEnabled }}', [720, -80]),
    booleanIf(key, 'Launch admission absent?', '={{ $json.launch === null }}', [840, -80]),
    code(
      key,
      'Return disabled launch',
      "return[{json:{launchEnabled:false,actorStarted:false,reason:'separate_foundation_acceptance_approval_required'}}];",
      [960, -240],
    ),
    execute(
      b,
      key,
      'Start guarded dev parent',
      'SUB-START',
      [
        ['workflow', 'string'],
        ['platform', 'any'],
        ['mode', 'string'],
        ['env', 'string'],
      ],
      { workflow: 'WF-99', platform: 'website_work_page', mode: 'manual', env: 'dev' },
      true,
      [960, -80],
    ),
    code(
      key,
      'Prepare exact launch admission',
      one +
        uuid +
        `const source=$('Validate smoke action').first().json;if(!uuid(j.run_id))throw Error('EMR_FOUNDATION_SMOKE_INPUT_INVALID');
const execution=String($execution.id??'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(execution))throw Error('EMR_FOUNDATION_SMOKE_INPUT_INVALID');
return[{json:{params:[{window_id:${JSON.stringify(transport.windowId)},launch_id:source.launch_id,run_id:j.run_id,account_id:source.account_id,execution_id:execution,actor_id:'aYG0l9s7dbB7j3gbS',actor_build:'0.3.99',input:${JSON.stringify(foundationSmokeInput)},memory_mb:1024,timeout_seconds:300,max_total_charge_usd:1}]}}];`,
      [1200, -80],
    ),
    code(
      key,
      'Validate first launch authorization',
      one +
        `const expected=$('Prepare exact launch admission').first().json.params[0];
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x!==null&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
if(j.authorized!==true||j.reason!=='first_post_only'||!j.launch||j.launch.launch_id!==expected.launch_id||j.launch.actor_id!==expected.actor_id||j.launch.actor_build!=='0.3.99'||stable(j.launch.input)!==stable(expected.input)||j.launch.apify_run_id!==null)throw Error('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
return[{json:{launch:j.launch}}];`,
      [1920, -80],
    ),
    {
      ...node(
        key,
        'Start exact actor once (disabled)',
        'httpRequest',
        {
          method: 'POST',
          url: 'https://api.apify.com/v2/actors/apify~website-content-crawler/runs',
          ...auth.parameters,
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ $json.launch.input }}',
          sendQuery: true,
          queryParameters: {
            parameters: [
              { name: 'waitForFinish', value: '0' },
              { name: 'restartOnError', value: 'false' },
              { name: 'memory', value: '1024' },
              { name: 'timeout', value: '300' },
              { name: 'build', value: '0.3.99' },
              { name: 'maxTotalChargeUsd', value: '1' },
              {
                name: 'webhooks',
                value: Buffer.from(
                  JSON.stringify([
                    {
                      eventTypes: [
                        'ACTOR.RUN.SUCCEEDED',
                        'ACTOR.RUN.FAILED',
                        'ACTOR.RUN.TIMED_OUT',
                        'ACTOR.RUN.ABORTED',
                      ],
                      requestUrl: 'https://muhhammedsayed.app.n8n.cloud/webhook/emr-apify-callback',
                      payloadTemplate: '{"eventType": {{eventType}}, "resource": {{resource}}}',
                    },
                  ]),
                ).toString('base64'),
              },
            ],
          },
          sendHeaders: false,
          options: {
            timeout: 15000,
            allowUnauthorizedCerts: false,
            redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
            sendCredentialsOnCrossOriginRedirect: false,
            response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
          },
        },
        [2160, -80],
      ),
      credentials: auth.credentials,
      retryOnFail: false,
      onError: 'continueRegularOutput',
      disabled: !release.launchEnabled,
    },
    code(
      key,
      'Retain original launch identifier',
      one +
        `const launch=$('Validate first launch authorization').first().json.launch;
const d=j.body?.data;
if(![200,201].includes(j.statusCode)||!d||typeof d.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(d.id)||d.actId!=='aYG0l9s7dbB7j3gbS')return[{json:{originalKnown:false,launch_id:launch.launch_id,reconciliationRequired:true,automaticRetry:false}}];
return[{json:{originalKnown:true,launch_id:launch.launch_id,apify_run_id:d.id,params:[launch.launch_id,d.id]}}];`,
      [2400, -80],
    ),
    booleanIf(key, 'Original actor id known?', '={{ $json.originalKnown }}', [2640, -80]),
    code(
      key,
      'Return ambiguous launch',
      one +
        `return[{json:{launch_id:j.launch_id,reconciliationRequired:true,actorPostMayHaveSucceeded:true,automaticRetry:false,replaceActor:false}}];`,
      [2880, -240],
    ),
    booleanIf(key, 'Original-run recovery requested?', "={{ $json.action === 'recover' }}", [720, 160]),
    code(
      key,
      'Prepare original-run recovery',
      one + `return[{json:{params:[j.launch_id,j.apify_run_id]}}];`,
      [960, 160],
    ),
    code(
      key,
      'Build verified registration request',
      one +
        `const source=$('Read original launch context').first().json;
if(!source.launch||!source.launch.apify_run_id)throw Error('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
return[{json:{apify_run_id:source.launch.apify_run_id,env:'dev',transport:'recovery'}}];`,
      [3600, 80],
    ),
    execute(
      b,
      key,
      'Recover registered callback',
      'WF-19',
      [
        ['apify_run_id', 'string'],
        ['env', 'string'],
        ['transport', 'string'],
      ],
      { apify_run_id: '={{ $json.apify_run_id }}', env: 'dev', transport: 'recovery' },
      true,
      [3840, 80],
    ),
  ];
  const authorize = gatewayOperationNodes(
    key,
    'Authorize exact actor launch',
    transport,
    'launch.authorize',
    '({launch:p[0]})',
    ['authorized', 'reason', 'launch'],
  );
  const before = gatewayOperationNodes(
    key,
    'Read launch admission before parent',
    transport,
    'launch.read',
    '({launchId:p[0]})',
    ['launch'],
    "[$('Validate smoke action').first().json.launch_id]",
  );
  // The server authenticates the original run and INPUT before the fixed SQL
  // reconcile; the workflow supplies only an ID hint plus the saved launch id.
  const reconcile = gatewayOperationNodes(
    key,
    'Reconcile original actor registration',
    transport,
    'launch.reconcile',
    '({launchId:p[0],apifyRunId:p[1]})',
    ['registered', 'launch'],
  );
  const read = gatewayOperationNodes(
    key,
    'Read original launch context',
    transport,
    'launch.read',
    '({launchId:p[0]})',
    ['launch'],
    "[$('Validate smoke action').first().json.launch_id]",
  );
  nodes.push(...before.nodes, ...authorize.nodes, ...reconcile.nodes, ...read.nodes);
  const connections = {
    ...line('When called', 'Validate smoke action', 'Launch requested?'),
    'Manual foundation smoke': { main: [[edge('Validate smoke action')]] },
    'Launch requested?': {
      main: [[edge('Approved launch gate (disabled)?')], [edge('Original-run recovery requested?')]],
    },
    'Approved launch gate (disabled)?': { main: [[edge(before.entry)], [edge('Return disabled launch')]] },
    ...before.connections,
    'Read launch admission before parent': { main: [[edge('Launch admission absent?')]] },
    'Launch admission absent?': {
      main: [[edge('Start guarded dev parent')], [edge('Return existing admission')]],
    },
    ...line('Start guarded dev parent', 'Prepare exact launch admission', authorize.entry),
    ...authorize.connections,
    ...line(
      'Authorize exact actor launch',
      'Validate first launch authorization',
      'Start exact actor once (disabled)',
      'Retain original launch identifier',
      'Original actor id known?',
    ),
    'Original actor id known?': { main: [[edge(reconcile.entry)], [edge('Return ambiguous launch')]] },
    'Original-run recovery requested?': {
      main: [[edge('Prepare original-run recovery')], [edge('Return disabled launch')]],
    },
    'Prepare original-run recovery': { main: [[edge(reconcile.entry)]] },
    ...reconcile.connections,
    'Reconcile original actor registration': { main: [[edge(read.entry)]] },
    ...read.connections,
    ...line(
      'Read original launch context',
      'Build verified registration request',
      'Recover registered callback',
    ),
  };
  nodes.push(
    code(
      key,
      'Return existing admission',
      one +
        `return[{json:{launch_id:j.launch.launch_id,reconciliationRequired:true,actorPostMayHaveSucceeded:true,automaticRetry:false,replaceActor:false}}];`,
      [1080, -320],
    ),
  );
  const graph = blueprint(b, key, nodes, connections, ['SUB-START', 'WF-19'], {
    runnableWorkflow: true,
    launchAvailable: true,
    launchEnabled: release.launchEnabled,
    remainingGates: [
      'separate approval and new source-only foundation window',
      'saved disabled graph and actual refs',
      'readonly provider token for bounded metadata/INPUT/dataset readback',
    ],
    providerRequests: {
      actorStarts: 1,
      originalRunAndInputGets: 2,
      callbackTerminalGets: 3,
      callbackDatasetGets: 1,
      retries: 0,
    },
    actor: {
      id: 'aYG0l9s7dbB7j3gbS',
      build: '0.3.99',
      buildId: 'BdKJRCYsnmlzPfH3n',
      memoryMb: 1024,
      timeoutSeconds: 300,
      maxTotalChargeUsd: 1,
      input: foundationSmokeInput,
    },
    recoveryGuarantee:
      'Original returned actor id only; unknown POST leaves durable admission unresolved and forbids every replacement POST.',
  });
  graph.requiredRefs.credentialKeys = ['apify', 'foundationGateway'];
  return compileFoundationGateway(graph, transport);
}
