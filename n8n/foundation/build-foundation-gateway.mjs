import {
  buildSharedWorkflows,
  buildErrorHandler,
  buildCollectorStubs,
  code,
  node,
  nodeId,
  line,
} from './build-foundation.mjs';
import { buildHealthWorkflow } from './build-health.mjs';
import { buildOrchestrator } from './build-orchestrator.mjs';
import { buildFoundationCallback } from './build-foundation-callback.mjs';
import { buildFoundationSmoke } from './build-foundation-smoke.mjs';

const sourceQuery = (query) => query.replace(/\s+/g, ' ').trim();
const mapping = new Map();
function fixed(query, operation, args, keys) {
  mapping.set(sourceQuery(query), { operation, args, keys });
}
fixed(
  'select ops.start_run($1, $2::app.platform, $3, $4, $5) as run_id;',
  'run.start',
  `({workflow:p[0],platform:p[1],mode:p[2],env:p[3],executionId:p[4]})`,
  ['run_id'],
);
fixed('select ops.log_cost($1::jsonb) as inserted;', 'cost.log', `({entries:JSON.parse(p[0])})`, [
  'inserted',
]);
fixed('select ops.log_workflow_error($1::jsonb) as logged;', 'error.log', `({entry:JSON.parse(p[0])})`, [
  'logged',
]);
fixed(
  'select ops.error_count_24h($1, $2) as error_count;',
  'error.count',
  `({workflow:p[0],claimNotify:p[1]})`,
  ['error_count'],
);
fixed('select ops.accrue_fixed_costs($1::date) as accrued;', 'fees.accrue', `({day:p[0]})`, ['accrued']);
fixed(
  "select ops.get_setting('stats_daily_enabled') as stats_daily_enabled, ((now() at time zone 'Africa/Cairo')::date - 1)::text as cairo_yesterday;",
  'health.guard',
  '({})',
  ['stats_daily_enabled', 'cairo_yesterday'],
);
fixed(
  "select ops.daily_health() as h, ((now() at time zone 'Africa/Cairo')::date - 1)::text as cairo_yesterday;",
  'health.read',
  '({})',
  ['h', 'cairo_yesterday'],
);
fixed(
  "select case when $4::text is null then ops.finish_run($1::uuid, $2, $3) else ops.get_apify_run($4)->'processing_result'->'run_summary' end as r, case when $4::text is null then null::jsonb else ops.get_apify_run($4)->'processing_result' end as durable;",
  'run.finish',
  '({runId:p[0],status:p[1],error:p[2],apifyRunId:p[3]})',
  ['r', 'durable'],
);
for (const query of [
  'select ops.process_apify_run($1, $2, $3, $4::numeric, $5::jsonb) as r;',
  'select ops.process_apify_run($1,$2,$3,$4,$5::jsonb) as receipt;',
])
  fixed(
    query,
    'apify.process',
    '({apifyRunId:p[0],status:p[1],datasetId:p[2],usageUsd:p[3],groups:JSON.parse(p[4])})',
    ['r'],
  );
fixed('select ops.get_apify_run($1) as registered;', 'apify.read', '({apifyRunId:p[0]})', ['registered']);
fixed(
  'select ops.get_apify_run($1) as registered, ops.apify_runs_pending($2::uuid) as pending;',
  'apify.completion.read',
  '({apifyRunId:p[0],runId:p[1]})',
  ['registered', 'pending'],
);

export function parseFoundationTransport(c) {
  const bad = () => {
    throw Error('FOUNDATION_TRANSPORT_INVALID');
  };
  if (
    !c ||
    Object.keys(c).length !== 3 ||
    !['audience', 'windowId', 'credential'].every((k) => Object.hasOwn(c, k))
  )
    bad();
  if (
    typeof c.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(c.audience) ||
    c.windowId !== 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
  )
    bad();
  const a = c.credential;
  if (
    !a ||
    Object.keys(a).length !== 3 ||
    !['id', 'name', 'type'].every((k) => Object.hasOwn(a, k)) ||
    typeof a.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(a.id) ||
    a.name !== 'M03 foundation machine [dev]' ||
    a.type !== 'httpCustomAuth'
  )
    bad();
  return structuredClone(c);
}
const runtime = `const fail=()=>{throw Error('EMR_FOUNDATION_RESPONSE_UNCONFIRMED');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const rows=$input.all();if(rows.length!==1||!object(rows[0].json))fail();const $json=rows[0].json;
`;
const prepareKnownCosts = `const bad=()=>{throw Error('EMR_FOUNDATION_COST_INVALID');};
const rows=$input.all();if(rows.length!==1)bad();const j=rows[0].json;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
if(!object(j)||Object.keys(j).some(k=>!['entries','env'].includes(k))||(j.env!==undefined&&j.env!=='dev')||!Array.isArray(j.entries)||j.entries.length>2)bad();
for(const e of j.entries){
if(!object(e)||Object.keys(e).some(k=>!['provider','category','quantity','unit','cost_usd','run_id','competitor_id','platform','item_id','day','meta'].includes(k))||
e.provider!=='apify'||e.category!=='scrape'||![0,1].includes(e.quantity)||e.unit!=='result'||!Number.isFinite(e.cost_usd)||e.cost_usd<0||e.cost_usd>999999.999999||
!uuid(e.run_id)||!uuid(e.competitor_id)||e.platform!=='website_work_page'||(e.item_id!==undefined&&e.item_id!==null)||
(e.day!==undefined&&e.day!==null&&(typeof e.day!=='string'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(e.day)))||
!exact(e.meta,['actor','apify_run_id','account_id','cost_key'])||e.meta.actor!=='apify/website-content-crawler'||typeof e.meta.apify_run_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(e.meta.apify_run_id)||!uuid(e.meta.account_id)||e.meta.cost_key!=='apify:'+e.meta.apify_run_id+':'+e.meta.account_id)bad();
}
return[{json:{params:[JSON.stringify(j.entries)]}}];`;
function http(key, name, c, body, position) {
  return {
    ...node(
      key,
      name,
      'httpRequest',
      {
        method: 'POST',
        url: c.audience + '/api/internal/n8n/foundation',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpCustomAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: body,
        sendHeaders: false,
        sendQuery: false,
        options: {
          timeout: 25000,
          allowUnauthorizedCerts: false,
          redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
          sendCredentialsOnCrossOriginRedirect: false,
          response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
        },
      },
      position,
    ),
    credentials: { httpCustomAuth: { id: c.credential.id, name: c.credential.name } },
    retryOnFail: false,
    onError: 'continueRegularOutput',
  };
}

/** A closed map of reviewed node operations, not a SQL/RPC/host tunnel. */
export function gatewayOperationNodes(
  key,
  name,
  c,
  operation,
  argsExpression,
  outputKeys,
  paramsExpression = '$json.params',
  position = [0, 0],
  projectExpression = 'result',
) {
  c = parseFoundationTransport(c);
  const prep = 'Prepare gateway · ' + name,
    invoke = 'Invoke gateway · ' + name,
    observe = 'Observe gateway · ' + name,
    status = 'Read durable gateway · ' + name;
  const p = position;
  const prepare =
    runtime +
    `const execution=String($execution.id??'');if(!/^[A-Za-z0-9_-]{1,200}$/.test(execution))fail();
const hash=purpose=>{const h=require('crypto').createHash('sha256').update(${JSON.stringify('emr-m03-foundation:' + key + ':' + name + ':')}+execution+':'+purpose).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
const p=${paramsExpression};if(!Array.isArray(p))fail();
let args;try{args=${argsExpression};}catch{fail();}
if(!object(args))fail();
return[{json:{request:{version:1,requestId:hash('business'),operation:${JSON.stringify(operation)},args},statusRequest:{version:1,requestId:hash('status'),operation:'request.status',args:{targetRequestId:hash('business')}}}}];`;
  const observeCode =
    runtime +
    `const prepared=$(${JSON.stringify(prep)}).first().json,r=rows[0].json;
const b=r.body;const observed=r.statusCode===200&&object(b)&&b.requestId===prepared.request.requestId&&b.operation===prepared.request.operation&&b.outcome==='completed'&&b.replayed===false&&exact(b.result,${JSON.stringify(outputKeys)});
// Retain no raw error, headers, request or provider response.
return[{json:{...prepared,observed,observedResult:${operation === 'launch.authorize' ? 'observed?b.result:null' : 'null'}}}];`;
  const resultCode =
    runtime +
    `const prepared=$(${JSON.stringify(observe)}).first().json,r=rows[0].json,b=r.body;
if(r.statusCode!==200||!object(b)||b.version!==1||b.requestId!==prepared.statusRequest.requestId||b.operation!==prepared.request.operation||b.outcome!=='completed'||b.replayed!==true)fail();
const w=b.window;if(!object(w)||w.id!==${JSON.stringify(c.windowId)}||w.boundAudience!==${JSON.stringify(c.audience)}||w.closed!==false||!Number.isSafeInteger(w.totalAdmitted)||w.totalAdmitted<1||w.totalAdmitted>256)fail();
const start=Date.parse(w.startsAt),end=Date.parse(w.expiresAt),now=Date.now();if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end<=start||end-start>3600000)fail();
const result=b.result;
if(!exact(result,${JSON.stringify(outputKeys)}))fail();
${operation === 'launch.authorize' ? "const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);if(!prepared.observed||prepared.observedResult?.authorized!==true||result.authorized!==true||stable(prepared.observedResult)!==stable(result)||end-now<360000)throw Error('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');" : ''}
return[{json:${projectExpression}}];`;
  return {
    nodes: [
      code(key, prep, prepare, p),
      http(key, invoke, c, '={{ $json.request }}', [p[0] + 120, p[1]]),
      code(key, observe, observeCode, [p[0] + 240, p[1]]),
      http(key, status, c, '={{ $json.statusRequest }}', [p[0] + 360, p[1]]),
      code(key, name, resultCode, [p[0] + 480, p[1]]),
    ],
    connections: line(prep, invoke, observe, status, name),
    entry: prep,
  };
}

export function compileFoundationGateway(input, config) {
  const c = parseFoundationTransport(config),
    graph = structuredClone(input),
    starts = new Map(),
    additions = {};
  graph.workflow.nodes = graph.workflow.nodes.flatMap((n) => {
    if (n.type !== 'n8n-nodes-base.postgres') {
      // n8n2.43.5 assigns a random webhookId during save for every type with
      // webhook definitions, including Wait in timeInterval mode. Pin both
      // types here so native save cannot alter the reviewed routing identity.
      // packages/workflow/src/node-helpers.ts:resolveNodeWebhookId
      // packages/nodes-base/nodes/{Webhook,Wait}/*.node.ts
      if (['n8n-nodes-base.webhook', 'n8n-nodes-base.wait'].includes(n.type))
        n.webhookId = nodeId(graph.key, 'Webhook routing: ' + n.name);
      return [n];
    }
    const spec = mapping.get(sourceQuery(n.parameters.query ?? ''));
    if (!spec) throw Error('FOUNDATION_OPERATION_UNMAPPED');
    const replacement = n.parameters.options?.queryReplacement;
    if (typeof replacement !== 'string' || !/^=\{\{ [\s\S]+ \}\}$/.test(replacement))
      throw Error('FOUNDATION_OPERATION_UNMAPPED');
    const expression = replacement.slice(4, -3);
    const allowed = [
      '$json.params',
      '[]',
      "[$('Validate health guard').first().json.cairo_yesterday]",
      "[$('Classify error').first().json.workflow, true]",
    ];
    if (!allowed.includes(expression)) throw Error('FOUNDATION_OPERATION_UNMAPPED');
    const op = gatewayOperationNodes(
      graph.key,
      n.name,
      c,
      spec.operation,
      spec.args,
      spec.keys,
      expression,
      n.position,
      n.parameters.query.endsWith('as receipt;') ? '{receipt:result.r}' : 'result',
    );
    starts.set(n.name, op.entry);
    Object.assign(additions, op.connections);
    return op.nodes;
  });
  for (const connection of Object.values(graph.workflow.connections))
    for (const branch of connection.main ?? [])
      for (const e of branch) if (starts.has(e.node)) e.node = starts.get(e.node);
  Object.assign(graph.workflow.connections, additions);
  graph.workflow.settings = {
    ...graph.workflow.settings,
    saveDataErrorExecution: 'none',
    saveDataSuccessExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  };
  graph.requiredRefs = {
    ...graph.requiredRefs,
    credentialKeys: [
      ...new Set(
        (graph.requiredRefs?.credentialKeys ?? [])
          .filter((k) => k !== 'postgres')
          .concat(starts.size ? ['foundationGateway'] : []),
      ),
    ],
  };
  const operations = graph.workflow.nodes.flatMap((n) =>
    typeof n.parameters?.jsCode === 'string'
      ? [...n.parameters.jsCode.matchAll(/operation:"([a-z.]+)"/g)].map((m) => m[1])
      : [],
  );
  return {
    ...graph,
    transport: 'fixed-https-foundation',
    hostedAcceptance: false,
    gatewayOperations: [...new Set(operations)],
    transportWindowId: c.windowId,
    liveWindowOpened: false,
  };
}

/** Source blueprints remain inactive; no credentials/network/Cloud writes occur. */
export function buildFoundationGatewayWorkflows(bindings, config, release = { launchEnabled: false }) {
  parseFoundationTransport(config);
  const ordinary = [
    ...buildCollectorStubs(bindings),
    ...buildSharedWorkflows(bindings),
    buildErrorHandler(bindings),
    buildOrchestrator(bindings),
    buildHealthWorkflow(bindings),
  ];
  ordinary
    .find((g) => g.key === 'SUB-COST')
    .workflow.nodes.find((n) => n.name === 'Prepare costs').parameters.jsCode = prepareKnownCosts;
  return [
    ...ordinary.map((graph) => compileFoundationGateway(graph, config)),
    buildFoundationCallback(bindings, config),
    buildFoundationSmoke(bindings, config, release),
  ];
}
