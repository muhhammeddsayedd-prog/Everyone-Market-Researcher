import { buildApifyCallback, cloudSmokeNormalizerSource } from './build-apify-callback.mjs';
import { createApifyRecoveryRuntime } from '../../packages/shared/src/n8n-apify-recovery.ts';
import { booleanIf, code, edge, line, nodeId } from './build-foundation.mjs';
import { compileFoundationGateway, gatewayOperationNodes } from './build-foundation-gateway.mjs';

const recovery = `const recovery=(${createApifyRecoveryRuntime.toString()})();\n`;
const one = `const rows=$input.all();if(rows.length!==1||!rows[0].json)throw Error('EMR_APIFY_CALLBACK_INVALID');const j=rows[0].json;\n`;
function replaceCode(g, name, js) {
  g.workflow.nodes.find((n) => n.name === name).parameters.jsCode = js;
}
function replaceWithOperation(g, names, c, operation, args, keys, params, output = 'result', unknown = null) {
  const old = g.workflow.nodes.find((n) => n.name === names[0]);
  const op = gatewayOperationNodes(
    'WF-19',
    names.at(-1),
    c,
    operation,
    args,
    keys,
    params,
    old.position,
    output,
  );
  if (unknown !== null) {
    const last = op.nodes.at(-1);
    last.parameters.jsCode = `try{${last.parameters.jsCode}}catch{return[{json:${JSON.stringify(unknown)}}];}`;
  }
  g.workflow.nodes = g.workflow.nodes.filter((n) => !names.includes(n.name)).concat(op.nodes);
  for (const connection of Object.values(g.workflow.connections))
    for (const branch of connection.main ?? [])
      for (const e of branch) if (e.node === names[0]) e.node = op.entry;
  const outgoing = g.workflow.connections[names.at(-1)];
  for (const name of names) delete g.workflow.connections[name];
  Object.assign(g.workflow.connections, op.connections, { [names.at(-1)]: outgoing });
}
export function buildFoundationCallback(bindings, transport) {
  let graph = buildApifyCallback(bindings);
  const key = 'WF-19';
  replaceCode(
    graph,
    'Bind registered context',
    recovery +
      one +
      `const source=$('Validate callback source').first().json;
let registry,completion;
try{if(j.registered===null)throw Error('unregistered');registry=recovery.registry(j.registered,source.apify_run_id);completion=recovery.savedReplay(j.registered,source.apify_run_id);}catch{
return[{json:{accepted:false,transport:source.transport,apify_run_id:source.apify_run_id,reason:j.registered===null?'unregistered':'registry_mismatch'}}];}
return[{json:{accepted:true,registry,transport:source.transport,replayed:completion!==null,completion}}];`,
  );
  graph.workflow.nodes.push(booleanIf(key, 'Registered callback?', '={{ $json.accepted }}', [840, 0]));
  graph.workflow.connections['Bind registered context'] = { main: [[edge('Registered callback?')]] };
  graph.workflow.connections['Registered callback?'] = {
    main: [[edge('Saved receipt?')], [edge('Prepare callback rejection')]],
  };
  replaceWithOperation(
    graph,
    ['Read first authenticated run'],
    transport,
    'apify.terminal.read',
    `({apifyRunId:p[0]})`,
    ['terminal', 'transport'],
    "[$('Bind registered context').first().json.registry.apify_run_id]",
    'result',
    { unconfirmed: true },
  );
  replaceWithOperation(
    graph,
    ['Read second authenticated run'],
    transport,
    'apify.terminal.read',
    `({apifyRunId:p[0]})`,
    ['terminal', 'transport'],
    "[$('Project first terminal').first().json.registry.apify_run_id]",
    'result',
    { unconfirmed: true },
  );
  replaceCode(
    graph,
    'Project first terminal',
    recovery +
      one +
      `const source=$('Bind registered context').first().json;
if(j.unconfirmed)return[{json:{accepted:false,transport:source.transport,apify_run_id:source.registry.apify_run_id,reason:'metadata_unavailable'}}];
let terminal;try{terminal=recovery.validateTerminal(j.terminal);if(terminal.apifyRunId!==source.registry.apify_run_id||terminal.parentRunId!==source.registry.run_id||terminal.accountId!==source.registry.account_ids[0])throw Error();}catch{return[{json:{accepted:false,transport:source.transport,apify_run_id:source.registry.apify_run_id,reason:'actor_mismatch'}}];}
return[{json:{...source,terminal,accepted:true,observed_at_ms:Date.now()}}];`,
  );
  graph.workflow.nodes.push(booleanIf(key, 'First metadata accepted?', '={{ $json.accepted }}', [1520, 80]));
  graph.workflow.connections['Project first terminal'] = { main: [[edge('First metadata accepted?')]] };
  graph.workflow.connections['First metadata accepted?'] = {
    main: [[edge('Settle cost for ten seconds')], [edge('Prepare callback rejection')]],
  };
  replaceCode(
    graph,
    'Verify stable terminal',
    recovery +
      one +
      `const source=$('Project first terminal').first().json;
let terminal;try{if(j.unconfirmed)throw Error();terminal=recovery.settle(source.terminal,j.terminal,Date.now()-source.observed_at_ms);}catch{return[{json:{accepted:false,transport:source.transport,apify_run_id:source.registry.apify_run_id,reason:'unsettled'}}];}
return[{json:{registry:source.registry,transport:source.transport,terminal,observed_at_ms:source.observed_at_ms,accepted:true,success:terminal.status==='SUCCEEDED'}}];`,
  );
  graph.workflow.nodes.push(booleanIf(key, 'Stable metadata accepted?', '={{ $json.accepted }}', [2300, 80]));
  graph.workflow.connections['Verify stable terminal'] = { main: [[edge('Stable metadata accepted?')]] };
  graph.workflow.connections['Stable metadata accepted?'] = {
    main: [[edge('Successful actor?')], [edge('Prepare callback rejection')]],
  };
  replaceWithOperation(
    graph,
    ['Dataset live release gate', 'Read bounded public dataset'],
    transport,
    'apify.dataset.read',
    '({apifyRunId:p[0]})',
    ['terminal', 'rows', 'transport'],
    "[$('Verify stable terminal').first().json.registry.apify_run_id]",
    'result',
    { unconfirmed: true },
  );
  replaceCode(
    graph,
    'Normalize exact public page',
    recovery +
      cloudSmokeNormalizerSource +
      '\n' +
      one +
      `const source=$('Verify stable terminal').first().json;
let payload;try{
if(j.unconfirmed||!j.transport||j.transport.runBytesMax!==65536||j.transport.datasetBytesMax!==262144||j.transport.requests!==2||j.transport.retries!==0||j.transport.socketsClosed!==true||!Array.isArray(j.rows)||j.rows.length!==1)throw Error();
recovery.settle(source.terminal,j.terminal,Date.now()-source.observed_at_ms);
const normalize=createM03SmokeWebsiteNormalizer(validateSmokeWebsiteRow,buildSmokeWebsiteSnapshot,invalidWebsiteRow);
payload=recovery.makeAtomicPayload(source.registry,source.terminal,[normalize(j.rows[0]).json]);
}catch{return[{json:{accepted:false,transport:source.transport,apify_run_id:source.registry.apify_run_id,reason:'unsupported_input'}}];}
return[{json:{accepted:true,registry:source.registry,transport:source.transport,payload,params:[payload.p_apify_run_id,payload.p_status,payload.p_dataset_id,payload.p_usage_usd,JSON.stringify(payload.p_groups)]}}];`,
  );
  graph.workflow.nodes.push(booleanIf(key, 'Dataset accepted?', '={{ $json.accepted }}', [3240, -20]));
  graph.workflow.connections['Normalize exact public page'] = { main: [[edge('Dataset accepted?')]] };
  graph.workflow.connections['Dataset accepted?'] = {
    main: [[edge('Prepare atomic request')], [edge('Prepare callback rejection')]],
  };
  graph.workflow.nodes.push(
    code(
      key,
      'Prepare callback rejection',
      one +
        `const execution=String($execution.id??'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(execution)||!['unregistered','actor_mismatch','registry_mismatch','unsettled','unsupported_input','registration_race','metadata_unavailable'].includes(j.reason))throw Error('EMR_APIFY_REJECTION_INVALID');
return[{json:{transport:j.transport,params:[execution,j.apify_run_id,j.reason]}}];`,
      [1200, -480],
    ),
  );
  const reject = gatewayOperationNodes(
    key,
    'Record exact callback rejection',
    transport,
    'callback.reject',
    '({executionId:p[0],apifyRunId:p[1],reason:p[2]})',
    ['recorded', 'action'],
  );
  graph.workflow.nodes.push(
    ...reject.nodes,
    code(
      key,
      'Return rejected callback',
      one +
        `if(j.action!=='apify_callback_rejected'||typeof j.recorded!=='boolean')throw Error('EMR_APIFY_REJECTION_INVALID');return[{json:{transport:$('Prepare callback rejection').first().json.transport,rejected:true,action:'apify_callback_rejected'}}];`,
      [1920, -480],
    ),
    booleanIf(key, 'Rejected webhook?', "={{ $json.transport === 'webhook' }}", [2160, -480]),
  );
  const respond = structuredClone(graph.workflow.nodes.find((n) => n.name === 'Respond processed'));
  respond.id = nodeId(key, 'Respond rejected');
  respond.name = 'Respond rejected';
  respond.parameters = {
    respondWith: 'json',
    responseBody: '={{ {ok:false,rejected:true} }}',
    options: { responseCode: 403, enableStreaming: false },
  };
  graph.workflow.nodes.push(respond);
  graph.workflow.connections['Prepare callback rejection'] = { main: [[edge(reject.entry)]] };
  Object.assign(
    graph.workflow.connections,
    reject.connections,
    line('Record exact callback rejection', 'Return rejected callback', 'Rejected webhook?'),
  );
  graph.workflow.connections['Rejected webhook?'] = { main: [[edge('Respond rejected')], []] };
  graph = compileFoundationGateway(graph, transport);
  // An ambiguous persistence acknowledgement must still reach the registry
  // reconciliation branch; never replay a write or replace its business ID.
  const atomic = graph.workflow.nodes.find((n) => n.name === 'Persist atomic callback');
  atomic.parameters.jsCode = `try{${atomic.parameters.jsCode}}catch{return[{json:{receipt:null}}];}`;
  graph.requiredRefs.credentialKeys = ['foundationGateway'];
  return {
    ...graph,
    runnableWorkflow: true,
    liveEnabled: false,
    remainingGates: [
      'new dev migration and separately approved foundation window',
      'new dev read-only provider token and exact saved native bindings',
      'reviewed final live batch',
    ],
    requestLimit: {
      terminalGets: 3,
      datasetGets: 1,
      runResponseBytes: 65536,
      datasetResponseBytes: 262144,
      rowsAccepted: 1,
      providerRetries: 0,
      costSettlementWaitSeconds: 10,
    },
    persistence: 'atomic original-run receipt; no arbitrary RPC/SQL/native fallback',
  };
}
