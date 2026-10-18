import { createRequire } from 'node:module';
import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { createApifyRecoveryRuntime } from '../../packages/shared/src/n8n-apify-recovery.ts';
import {
  node,
  nodeId,
  code,
  postgres,
  trigger,
  blueprint,
  booleanIf,
  execute,
  edge,
  line,
} from './build-foundation.mjs';

const require = createRequire(import.meta.url);
const shared = require('../normalizers/smoke_website_stub.js');
const { createM03SmokeWebsiteNormalizer } = require('../normalizers/smoke_website_m03.js');
const runtime = `const recovery=(${createApifyRecoveryRuntime.toString()})();\n`;
const normalizer = [
  shared.invalidWebsiteRow,
  shared.smokeBoundedText,
  shared.validateSmokeWebsiteRow,
  shared.buildSmokeWebsiteSnapshot,
  createM03SmokeWebsiteNormalizer,
]
  .map((fn) => fn.toString())
  .join('\n\n');
export const cloudSmokeNormalizerSource = normalizer;

// These three types have pinned official-source provenance, not an actual
// instance import/execution receipt. No existing observed-type guard is relaxed.
export const callbackNodeSources = Object.freeze({
  wait: { version: 1.1, path: 'Wait/Wait.node.ts' },
  webhook: { version: 2.2, path: 'Webhook/Webhook.node.ts' },
  respondToWebhook: { version: 1.5, path: 'RespondToWebhook/RespondToWebhook.node.ts' },
});
function sourceNode(key, name, type, parameters, position) {
  const schema = callbackNodeSources[type];
  if (!schema) throw new Error('EMR_N8N_NODE_SCHEMA_MISMATCH');
  return {
    id: nodeId(key, name),
    name,
    type: `n8n-nodes-base.${type}`,
    typeVersion: schema.version,
    parameters,
    position,
  };
}
function noRetry(n) {
  const result = { ...n, retryOnFail: false };
  delete result.maxTries;
  delete result.waitBetweenTries;
  return result;
}
function authenticatedGet(bindings, key, name, url, position) {
  const auth = httpCredentialBinding(bindings, 'apify');
  return {
    ...node(
      key,
      name,
      'httpRequest',
      {
        method: 'GET',
        url,
        ...auth.parameters,
        sendBody: false,
        sendQuery: false,
        sendHeaders: false,
        options: {
          timeout: 60000,
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

const extract = `const bad=()=>{throw new Error('EMR_APIFY_NOTIFICATION_INVALID');};
const rows=$input.all(),object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
if(rows.length!==1||!object(rows[0].json))bad();
const j=rows[0].json;
let id,transport;
if(Object.hasOwn(j,'body')){
  const b=j.body;
  if(!object(b)||!['ACTOR.RUN.SUCCEEDED','ACTOR.RUN.FAILED','ACTOR.RUN.TIMED_OUT','ACTOR.RUN.ABORTED'].includes(b.eventType)||!object(b.resource))bad();
  id=b.resource.id;transport='webhook';
}else{
  if(Object.keys(j).some(k=>!['apify_run_id','env','transport'].includes(k))||j.env!=='dev'||j.transport!=='recovery')bad();
  id=j.apify_run_id;transport='recovery';
}
if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))bad();
return[{json:{apify_run_id:id,transport,params:[id]}}];`;

const registry =
  runtime +
  `const source=$('Validate callback source').first().json,rows=$input.all();
if(rows.length!==1||!Object.hasOwn(rows[0].json,'registered'))throw new Error('EMR_APIFY_REGISTRY_INVALID');
const raw=rows[0].json.registered;
// A generic WF90 log is not the required durable rejection audit.
if(raw===null)throw new Error('EMR_APIFY_UNKNOWN_CALLBACK_AUDIT_UNAVAILABLE');
const registry=recovery.registry(raw,source.apify_run_id);
const completion=recovery.savedReplay(raw,source.apify_run_id);
return[{json:{registry,transport:source.transport,replayed:completion!==null,completion,run_url:'https://api.apify.com/v2/actor-runs/'+source.apify_run_id+'?waitForFinish=0'}}];`;

const first =
  runtime +
  `const input=$('Bind registered context').first().json,rows=$input.all();
if(rows.length!==1||rows[0].json.statusCode!==200)throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');
const terminal=recovery.projectTerminal(rows[0].json.body,input.registry);
return[{json:{registry:input.registry,transport:input.transport,terminal,observed_at_ms:Date.now(),run_url:input.run_url}}];`;

const second =
  runtime +
  `const first=$('Project first terminal').first().json,rows=$input.all();
if(rows.length!==1||rows[0].json.statusCode!==200)throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');
const terminal=recovery.settle(first.terminal,recovery.projectTerminal(rows[0].json.body,first.registry),Date.now()-first.observed_at_ms);
// The fifth top-level field preserves actor failure-marker rejection. Its raw
// content, like nested metadata/crawl context, is not approved for execution
// storage. The unconditional live release gate remains before the dataset GET.
return[{json:{registry:first.registry,transport:first.transport,terminal,success:terminal.status==='SUCCEEDED',dataset_url:terminal.datasetId===null?null:'https://api.apify.com/v2/datasets/'+terminal.datasetId+'/items?format=json&offset=0&limit=2&skipHidden=true&fields=url%2Cmarkdown%2Cmetadata%2Ccrawl%2Cerror'}}];`;

const dataset =
  runtime +
  normalizer +
  `
const source=$('Verify stable terminal').first().json,rows=$input.all();
const bad=()=>{throw new Error('EMR_APIFY_DATASET_INVALID');};
if(rows.length!==1||rows[0].json.statusCode!==200||!Array.isArray(rows[0].json.body)||rows[0].json.body.length!==1)bad();
let encoded;try{encoded=JSON.stringify(rows[0].json.body);}catch{bad();}
// A post-response bound, not a streaming/transport-size guarantee.
let bytes=0;for(const c of encoded){const p=c.codePointAt(0);bytes+=p<=127?1:p<=2047?2:p<=65535?3:4;if(bytes>1048576)bad();}
const row=rows[0].json.body[0];
if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['url','markdown','metadata','crawl','error'].includes(k)))bad();
const normalize=createM03SmokeWebsiteNormalizer(validateSmokeWebsiteRow,buildSmokeWebsiteSnapshot,invalidWebsiteRow);
let item;try{item=normalize(row).json;}catch{bad();}
const payload=recovery.makeAtomicPayload(source.registry,source.terminal,[item]);
return[{json:{registry:source.registry,transport:source.transport,payload,params:[payload.p_apify_run_id,payload.p_status,payload.p_dataset_id,payload.p_usage_usd,JSON.stringify(payload.p_groups)]}}];`;

const empty =
  runtime +
  `const rows=$input.all();
if(rows.length!==1)throw new Error('EMR_APIFY_GROUP_INVALID');
const source=rows[0].json,payload=recovery.makeAtomicPayload(source.registry,source.terminal,[]);
return[{json:{registry:source.registry,transport:source.transport,payload,params:[payload.p_apify_run_id,payload.p_status,payload.p_dataset_id,payload.p_usage_usd,JSON.stringify(payload.p_groups)]}}];`;

const prepare = `const rows=$input.all();if(rows.length!==1||!rows[0].json.payload||!Array.isArray(rows[0].json.params)||rows[0].json.params.length!==5)throw new Error('EMR_APIFY_GROUP_INVALID');return rows;`;
const atomicResult =
  runtime +
  `const source=$('Prepare atomic request').first().json,rows=$input.all();
let observedReceipt=null;
// A missing or malformed native response is not proof that the transaction
// failed. Discard raw error context and always read the actual saved registry.
if(rows.length===1&&rows[0].json.receipt){
  try{observedReceipt=recovery.validateReceipt(rows[0].json.receipt,source.registry,source.payload);}catch{}
}
return[{json:{...source,observedReceipt,responseClass:observedReceipt===null?'ambiguous':'verified',params:[source.registry.apify_run_id,source.registry.run_id]}}];`;
const durable =
  runtime +
  `const source=$('Validate atomic response').first().json,rows=$input.all();
if(rows.length!==1||!Number.isSafeInteger(rows[0].json.pending)||rows[0].json.pending<0)throw new Error('EMR_APIFY_COMPLETION_READBACK_INVALID');
const result=recovery.reconcileAtomic(rows[0].json.registered,source.payload,source.observedReceipt??undefined);
if(result.action!=='complete')throw new Error('EMR_APIFY_ATOMIC_UNPROCESSED_REQUIRES_MANUAL_SAME_ARGS');
if(rows[0].json.pending!==0)throw new Error('EMR_APIFY_COMPLETION_READBACK_INVALID');
// A complete saved result without an observed native transition is a replay:
// its false flags deliberately suppress downstream stub dispatch.
const completion=result.receipt;
return[{json:{transport:source.transport,completion,payloadEqualityVerified:result.payloadEqualityVerified,run_id:completion.run_id,status:completion.run_summary.status}}];`;
const afterFinish = `const source=$('Confirm durable completion').first().json,rows=$input.all();
const expected=source.completion.run_summary;
if(rows.length!==1||!rows[0].json||Object.keys(expected).some(k=>rows[0].json[k]!==expected[k]))throw new Error('EMR_APIFY_FINISH_READBACK_INVALID');
return[{json:{transport:source.transport,completion:source.completion,payloadEqualityVerified:source.payloadEqualityVerified}}];`;

export function buildApifyCallback(input) {
  const b = parseN8nBindings(input),
    key = 'WF-19';
  if (!b.credentials?.postgres || !b.credentials?.apify) throw new Error('EMR_N8N_BINDING_MISSING');
  const nodes = [
    sourceNode(
      key,
      'Apify callback',
      'webhook',
      {
        httpMethod: 'POST',
        path: 'emr-apify-callback',
        authentication: 'none',
        responseMode: 'responseNode',
        options: {},
      },
      [0, -120],
    ),
    trigger(key, [
      ['apify_run_id', 'string'],
      ['env', 'string'],
      ['transport', 'string'],
    ]),
    code(key, 'Validate callback source', extract, [240, 0]),
    noRetry(
      postgres(
        b,
        key,
        'Read registered context',
        'select ops.get_apify_run($1) as registered;',
        '={{ $json.params }}',
        [480, 0],
      ),
    ),
    code(key, 'Bind registered context', registry, [720, 0]),
    booleanIf(key, 'Saved receipt?', '={{ $json.replayed }}', [960, 0]),
    code(
      key,
      'Return saved receipt',
      'const j=$input.all()[0].json;return[{json:{transport:j.transport,completion:j.completion,payloadEqualityVerified:false}}];',
      [1200, -180],
    ),
    authenticatedGet(b, key, 'Read first authenticated run', '={{ $json.run_url }}', [1200, 80]),
    code(key, 'Project first terminal', first, [1440, 80]),
    sourceNode(
      key,
      'Settle cost for ten seconds',
      'wait',
      { resume: 'timeInterval', amount: 10, unit: 'seconds' },
      [1680, 80],
    ),
    authenticatedGet(
      b,
      key,
      'Read second authenticated run',
      "={{ $('Project first terminal').first().json.run_url }}",
      [1920, 80],
    ),
    code(key, 'Verify stable terminal', second, [2160, 80]),
    booleanIf(key, 'Successful actor?', '={{ $json.success }}', [2400, 80]),
    code(
      key,
      'Dataset live release gate',
      "throw new Error('EMR_APIFY_DATASET_LIVE_REVIEW_REQUIRED');",
      [2640, -20],
    ),
    authenticatedGet(b, key, 'Read bounded public dataset', '={{ $json.dataset_url }}', [2880, -20]),
    code(key, 'Normalize exact public page', dataset, [3120, -20]),
    code(key, 'Prepare failed actor group', empty, [2640, 220]),
    code(key, 'Prepare atomic request', prepare, [3360, 80]),
    {
      ...noRetry(
        postgres(
          b,
          key,
          'Persist atomic callback',
          'select ops.process_apify_run($1,$2,$3,$4,$5::jsonb) as receipt;',
          '={{ $json.params }}',
          [3600, 80],
        ),
      ),
      onError: 'continueRegularOutput',
    },
    code(key, 'Validate atomic response', atomicResult, [3840, 80]),
    noRetry(
      postgres(
        b,
        key,
        'Read saved completion and pending',
        'select ops.get_apify_run($1) as registered, ops.apify_runs_pending($2::uuid) as pending;',
        '={{ $json.params }}',
        [4080, 80],
      ),
    ),
    code(key, 'Confirm durable completion', durable, [4320, 80]),
    execute(
      b,
      key,
      'Confirm finish and dispatch stubs',
      'SUB-FINISH',
      [
        ['run_id', 'string'],
        ['status', 'string'],
        ['error', 'any'],
        ['completion', 'any'],
        ['env', 'string'],
      ],
      {
        run_id: '={{ $json.run_id }}',
        status: '={{ $json.status }}',
        error: null,
        completion: '={{ $json.completion }}',
        env: 'dev',
      },
      true,
      [4560, 80],
    ),
    code(key, 'Return first completion', afterFinish, [4800, 80]),
    booleanIf(key, 'Webhook response?', "={{ $json.transport === 'webhook' }}", [5040, 0]),
    sourceNode(
      key,
      'Respond processed',
      'respondToWebhook',
      {
        respondWith: 'json',
        responseBody:
          '={{ { ok: true, processed: true, replayed: !$json.completion.updated, apify_run_id: $json.completion.apify_run_id } }}',
        options: { responseCode: 200, enableStreaming: false },
      },
      [5280, -100],
    ),
    code(
      key,
      'Return recovery receipt',
      'return $input.all().map(item=>({json:{completion:item.json.completion,payloadEqualityVerified:item.json.payloadEqualityVerified}}));',
      [5280, 100],
    ),
  ];
  const connections = {
    ...line(
      'When called',
      'Validate callback source',
      'Read registered context',
      'Bind registered context',
      'Saved receipt?',
    ),
    'Apify callback': { main: [[edge('Validate callback source')]] },
    'Saved receipt?': { main: [[edge('Return saved receipt')], [edge('Read first authenticated run')]] },
    'Return saved receipt': { main: [[edge('Webhook response?')]] },
    ...line(
      'Read first authenticated run',
      'Project first terminal',
      'Settle cost for ten seconds',
      'Read second authenticated run',
      'Verify stable terminal',
      'Successful actor?',
    ),
    'Successful actor?': {
      main: [[edge('Dataset live release gate')], [edge('Prepare failed actor group')]],
    },
    ...line(
      'Dataset live release gate',
      'Read bounded public dataset',
      'Normalize exact public page',
      'Prepare atomic request',
    ),
    'Prepare failed actor group': { main: [[edge('Prepare atomic request')]] },
    ...line(
      'Prepare atomic request',
      'Persist atomic callback',
      'Validate atomic response',
      'Read saved completion and pending',
      'Confirm durable completion',
      'Confirm finish and dispatch stubs',
      'Return first completion',
      'Webhook response?',
    ),
    'Webhook response?': { main: [[edge('Respond processed')], [edge('Return recovery receipt')]] },
  };
  const result = blueprint(b, key, nodes, connections, ['SUB-FINISH'], {
    runnableWorkflow: false,
    remainingGates: [
      'durable unknown-callback rejection audit',
      'live dataset privacy/output-shape/storage review before release gate removal',
      'transport response-byte limit before any live dataset request',
      'actual native Webhook/Wait/Respond schemas and writer TLS',
      'reviewed paid foundation batch',
    ],
    sourceOnlyNodeTypes: Object.keys(callbackNodeSources),
    sourceOnlyNodeProvenance: Object.fromEntries(
      Object.entries(callbackNodeSources).map(([type, s]) => [
        type,
        `https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/${s.path}`,
      ]),
    ),
    requestLimit: {
      authenticatedRunGets: 2,
      datasetGets: 1,
      datasetRowsRequested: 2,
      datasetRowsAccepted: 1,
      postParseDatasetBytes: 1048576,
      transportDatasetBytesVerified: false,
      costSettlementWaitSeconds: 10,
      maximumSettlementElapsedMs: 180000,
    },
    dispatchGuarantee:
      'at-least-once stubs only; replayed stored receipt never dispatches; no external exactly-once outbox claim',
  });
  result.requiredRefs.credentialKeys = ['postgres', 'apify'];
  return result;
}
