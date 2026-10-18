import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  parseN8nBindings,
  collectorStubSpecs,
  foundationWorkflowNames,
  alertKinds,
} from '../../packages/shared/src/n8n-bindings.ts';

export { collectorStubSpecs };

// Native JSON blueprints, never actual n8n exports. Parameter shapes below are
// from n8n@2.43.5 official source, checked against the actual sanitized probe.
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.ts
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Set/v2/manual.mode.ts
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Code/Code.node.ts
const expectedVersions = Object.freeze({
  manualTrigger: 1,
  executeWorkflowTrigger: 1.3,
  code: 2,
  set: 3.5,
  postgres: 2.7,
  executeWorkflow: 1.4,
  errorTrigger: 1,
  if: 2.3,
  scheduleTrigger: 1.4,
  switch: 3.4,
  httpRequest: 4.5,
});
const actualProbe = JSON.parse(
  readFileSync(
    new URL('../../milestones/M03-n8n-foundation/evidence/sanitizedprobe.json', import.meta.url),
    'utf8',
  ).replace(/^\uFEFF/, ''),
);

function assertObservedNodeType(type) {
  const fullType = `n8n-nodes-base.${type}`;
  if (!actualProbe.nodes.some((n) => n.type === fullType && n.typeVersion === expectedVersions[type]))
    throw new Error('EMR_N8N_NODE_SCHEMA_MISMATCH');
}

export function nodeId(key, name) {
  const hex = createHash('sha256').update(`emr-m03-dev:${key}:${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function node(key, name, type, parameters, position) {
  assertObservedNodeType(type);
  return {
    id: nodeId(key, name),
    name,
    type: `n8n-nodes-base.${type}`,
    typeVersion: expectedVersions[type],
    parameters,
    position,
  };
}

export function ref(bindings, key) {
  if (!bindings.workflowRefs[key]) throw new Error('EMR_N8N_BINDING_MISSING');
  return bindings.workflowRefs[key];
}

export function tags(bindings, names) {
  return names.map((name) => {
    if (!bindings.tagRefs[name]) throw new Error('EMR_N8N_BINDING_MISSING');
    return bindings.tagRefs[name];
  });
}

export function trigger(key, fields) {
  return node(
    key,
    'When called',
    'executeWorkflowTrigger',
    {
      inputSource: 'workflowInputs',
      workflowInputs: { values: fields.map(([name, type]) => ({ name, type })) },
    },
    [0, 0],
  );
}

export function settings(bindings, key) {
  return {
    executionOrder: 'v1',
    timezone: 'Africa/Cairo',
    executionTimeout: 900,
    callerPolicy: 'workflowsFromSameOwner',
    availableInMCP: false,
    ...(key === 'WF-90' ? {} : { errorWorkflow: ref(bindings, 'WF-90').id }),
  };
}

export function edge(name) {
  return { node: name, type: 'main', index: 0 };
}

const stubInputCode = (key) => `const items = $input.all();
const invalid = () => { throw new Error('EMR_N8N_INPUT_INVALID'); };
if (items.length !== 1) invalid();
const j = items[0].json;
if (!j || typeof j !== 'object' || Array.isArray(j) ||
  Object.keys(j).some(k => !${JSON.stringify(['mode', 'limit', 'result_type', 'env', ...(key === 'WF-70' ? ['tags'] : []), ...(key === 'WF-80' ? ['kind'] : [])])}.includes(k))) invalid();
if (j.env !== undefined && j.env !== null && j.env !== 'dev') invalid();
const mode = j.mode ?? 'manual';
if (!['daily','backfill','weekly','manual','removal_check'].includes(mode)) invalid();
const limit = j.limit ?? null;
if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) invalid();
const result_type = j.result_type ?? null;
if (result_type !== null && (typeof result_type !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(result_type))) invalid();
${
  key === 'WF-70'
    ? `const tags = j.tags ?? [];
if (!Array.isArray(tags) || tags.length>20 || tags.some(t=>typeof t!=='string' || !/^[A-Za-z0-9_-]{1,64}$/.test(t))) invalid();`
    : ''
}
${
  key === 'WF-80'
    ? `const kind = j.kind ?? null;
if (kind!==null && !${JSON.stringify(alertKinds)}.includes(kind)) invalid();`
    : ''
}
return [{json:{mode,limit,result_type,env:'dev'${key === 'WF-70' ? ',tags' : ''}${key === 'WF-80' ? ',kind' : ''}}}];`;

export function buildCollectorStubs(input) {
  const bindings = parseN8nBindings(input);
  ref(bindings, 'WF-90');
  return collectorStubSpecs.map((spec) => {
    const key = spec.key;
    const tagNames = [
      'env:dev',
      `layer:${spec.layer}`,
      ...(spec.platform ? [`platform:${spec.platform}`] : []),
    ];
    const workflow = {
      name: foundationWorkflowNames[key],
      active: false,
      nodes: [
        trigger(key, [
          ['mode', 'string'],
          ['limit', 'number'],
          ['result_type', 'string'],
          ['env', 'string'],
          ...(key === 'WF-70' ? [['tags', 'array']] : []),
          ...(key === 'WF-80' ? [['kind', 'string']] : []),
        ]),
        node(key, 'Manual test', 'manualTrigger', {}, [0, 200]),
        node(
          key,
          'Validate dev input',
          'code',
          { mode: 'runOnceForAllItems', jsCode: stubInputCode(key) },
          [240, 0],
        ),
        node(
          key,
          'Return stub',
          'set',
          {
            mode: 'manual',
            includeOtherFields: false,
            assignments: {
              assignments: [
                { id: nodeId(key, 'stub-field'), name: 'stub', type: 'boolean', value: true },
                { id: nodeId(key, 'workflow-field'), name: 'workflow', type: 'string', value: key },
                {
                  id: nodeId(key, 'received-field'),
                  name: 'received',
                  type: 'object',
                  value: '={{ $json }}',
                },
              ],
            },
            options: {},
          },
          [480, 0],
        ),
      ],
      connections: {
        'When called': { main: [[edge('Validate dev input')]] },
        'Manual test': { main: [[edge('Validate dev input')]] },
        'Validate dev input': { main: [[edge('Return stub')]] },
      },
      settings: settings(bindings, key),
      tags: tags(bindings, tagNames),
      pinData: {},
    };
    return {
      key,
      kind: 'native-json-blueprint',
      hostedAcceptance: false,
      requiredRefs: { workflowKeys: ['WF-90'], tagNames, credentialKeys: [] },
      workflow,
    };
  });
}

// Pinned native schemas: Postgres v2 executeQuery.operation.ts accepts an array
// expression in options.queryReplacement. ExecuteWorkflow1.4 requires the full
// resource-mapper value/schema. If2.3 uses filter conditions version3; its boolean
// "true" operator is defined in packages/workflow/src/node-parameters/filter-parameter.ts.
// No Code node imports packages or accesses credentials, HTTP or filesystem.
export const inputPrelude = `const invalid = () => { throw new Error('EMR_N8N_INPUT_INVALID'); };
const items = $input.all();
if (items.length !== 1) invalid();
const j = items[0].json;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x,allowed,required=[]) => object(x) && Object.keys(x).every(k=>allowed.includes(k)) && required.every(k=>Object.hasOwn(x,k));
const uuid = x => typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const identifier = x => typeof x==='string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
if (!object(j) || (j.env !== undefined && j.env !== null && j.env !== 'dev')) invalid();
`;

export function code(key, name, jsCode, position) {
  return node(key, name, 'code', { mode: 'runOnceForAllItems', jsCode }, position);
}
export function postgres(bindings, key, name, query, replacement, position) {
  if (!bindings.credentials?.postgres) throw new Error('EMR_N8N_BINDING_MISSING');
  const pg = bindings.credentials.postgres;
  return {
    ...node(
      key,
      name,
      'postgres',
      {
        operation: 'executeQuery',
        query,
        options: {
          queryReplacement: replacement,
          queryBatching: 'single',
          connectionTimeout: 30,
          largeNumbersOutput: 'text',
        },
      },
      position,
    ),
    credentials: { postgres: { id: pg.id, name: pg.name } },
    ...(key === 'SUB-START' || name === 'Claim notification'
      ? { retryOnFail: false }
      : { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  };
}
export function blueprint(bindings, key, nodes, connections, workflowKeys = [], extra = {}) {
  const tagNames = ['env:dev', key.startsWith('SUB-') ? 'layer:sub' : 'layer:ops'];
  for (const k of workflowKeys) ref(bindings, k);
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    requiredRefs: {
      workflowKeys: [...new Set([...workflowKeys, ...(key === 'WF-90' ? [] : ['WF-90'])])],
      tagNames,
      credentialKeys: ['postgres'],
    },
    ...extra,
    workflow: {
      name: foundationWorkflowNames[key],
      active: false,
      nodes,
      connections,
      settings: settings(bindings, key),
      tags: tags(bindings, tagNames),
      pinData: {},
    },
  };
}
export const line = (...names) =>
  Object.fromEntries(names.slice(0, -1).map((name, i) => [name, { main: [[edge(names[i + 1])]] }]));

const startCode =
  inputPrelude +
  `if (!exact(j,['workflow','platform','mode','env'],['workflow','platform','mode','env']) ||
  !/^WF-[0-9]{2}[a-z]?$/.test(j.workflow) || !['daily','backfill','weekly','manual','removal_check'].includes(j.mode) || j.env!=='dev') invalid();
if (j.platform!==null && !['vimeo','instagram','instagram_stories','website','website_work_page','linkedin','linkedin_employees','youtube','news'].includes(j.platform)) invalid();
const execution = String($execution.id ?? '');
if (!identifier(execution)) invalid();
return [{json:{params:[j.workflow,j.platform,j.mode,'dev',execution]}}];`;

const costCode =
  inputPrelude +
  `if (!exact(j,['entries','env'],['entries']) || !Array.isArray(j.entries) || j.entries.length>500) invalid();
const providers=['apify','openai','serpapi','firecrawl','vimeo','youtube','n8n','supabase','vercel','email','other'];
for(const e of j.entries) {
  if (!exact(e,['provider','category','quantity','unit','cost_usd','run_id','competitor_id','platform','item_id','meta','day'],
    ['provider','category','quantity','unit','cost_usd','meta']) || !providers.includes(e.provider) ||
    typeof e.category!=='string' || !e.category.trim() || e.category.length>64 ||
    typeof e.unit!=='string' || !e.unit.trim() || e.unit.length>64 ||
    !Number.isFinite(e.quantity) || e.quantity<0 || !Number.isFinite(e.cost_usd) || e.cost_usd<0 ||
    !exact(e.meta,['cost_key'],['cost_key']) ||
    typeof e.meta.cost_key!=='string' || !/^[A-Za-z0-9_.:/-]{1,256}$/.test(e.meta.cost_key)) invalid();
  // M03 adapter restriction: only the stable cost key. Atomic callback and
  // fixed-fee RPCs construct their own attribution metadata inside SQL.
  // This structural minimization is not a general secret detector.
  for(const k of ['run_id','competitor_id','item_id']) if(e[k]!==undefined && e[k]!==null && !uuid(e[k])) invalid();
  if(e.day!==undefined && e.day!==null && (typeof e.day!=='string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e.day))) invalid();
}
let serialized;
try { serialized=JSON.stringify(j.entries); } catch { invalid(); }
let bytes=0;
for(const c of serialized) {
  const point=c.codePointAt(0);
  bytes+=point<=127?1:point<=2047?2:point<=65535?3:4;
  if(bytes>1048576) invalid();
}
return [{json:{params:[serialized]}}];`;

const ingestCode =
  inputPrelude +
  `if(!exact(j,['apify_run_id','status','dataset_id','usage_usd','groups','env'],
  ['apify_run_id','status','dataset_id','usage_usd','groups']) || typeof j.apify_run_id!=='string' ||
  !/^[A-Za-z0-9_-]{1,128}$/.test(j.apify_run_id) || !['SUCCEEDED','FAILED','TIMED_OUT','ABORTED'].includes(j.status) ||
  !Number.isFinite(j.usage_usd) || j.usage_usd<0 || j.usage_usd>999999.999999 ||
  (j.dataset_id!==null && (typeof j.dataset_id!=='string' || j.dataset_id.length>200)) ||
  (j.status==='SUCCEEDED' && (typeof j.dataset_id!=='string' || !j.dataset_id.trim())) ||
  !Array.isArray(j.groups) || j.groups.length!==1) invalid();
const g=j.groups[0];
if(!exact(g,['account_id','items','normalizer_version'],['account_id','items','normalizer_version']) ||
  !uuid(g.account_id) || g.normalizer_version!=='smoke_website_stub.v1' || !Array.isArray(g.items) || g.items.length>1 ||
  (j.status!=='SUCCEEDED' && g.items.length!==0)) invalid();
let serialized;
try {serialized=JSON.stringify(j.groups);} catch {invalid();}
let bytes=0;
for(const c of serialized) {const p=c.codePointAt(0);bytes+=p<=127?1:p<=2047?2:p<=65535?3:4;if(bytes>1048576)invalid();}
// The caller must obtain final metadata through authenticated Apify readback.
// The restricted SQL RPC binds the account/source and owns atomic persistence.
return [{json:{params:[j.apify_run_id,j.status,j.dataset_id,j.usage_usd,serialized]}}];`;

const notifyFields = [
  ['to', 'array'],
  ['subject', 'string'],
  ['html', 'string'],
  ['text', 'string'],
  ['workflow', 'string'],
  ['execution_id', 'string'],
  ['env', 'string'],
];
const notifyCode =
  inputPrelude +
  `if (!exact(j,['to','subject','html','text','workflow','execution_id','env'])) invalid();
if(j.to!==undefined && j.to!==null && (!Array.isArray(j.to) || j.to.length!==1 || j.to[0]!=='mohamed.abdelrahman@everyone.film')) invalid();
for(const k of ['subject','html','text']) if(j[k]!==undefined && j[k]!==null && (typeof j[k]!=='string' || j[k].length>8192)) invalid();
const workflow=j.workflow ?? 'SUB-NOTIFY';
const execution=j.execution_id ?? String($execution.id ?? '');
if(!identifier(workflow) || !identifier(execution)) invalid();
const audit={kind:'notify',workflow,execution_id:execution,node:'Notify',message:'notify_threshold_reached'};
return [{json:{params:[JSON.stringify(audit)]}}];`;

const completionKeys = [
  'updated',
  'finished_now',
  'apify_run_id',
  'run_id',
  'account_ids',
  'status',
  'dataset_id',
  'cost_usd',
  'groups_sha256',
  'normalizer_version',
  'cost_keys',
  'items_seen',
  'items_new',
  'new_item_ids',
  'accounts_ok',
  'accounts_failed',
  'run_summary',
];
const summaryKeys = [
  'run_id',
  'status',
  'accounts_total',
  'accounts_ok',
  'accounts_failed',
  'items_seen',
  'items_new',
  'cost_usd',
];
const finishCode =
  inputPrelude +
  `if (!exact(j,['run_id','status','error','completion','env'],['run_id','status']) || !uuid(j.run_id) ||
  !['success','partial','failed'].includes(j.status) || (j.error!==undefined && j.error!==null && (typeof j.error!=='string' || j.error.length>4096))) invalid();
const completion=j.completion ?? null;
if(completion!==null && j.error!==undefined && j.error!==null) invalid();
if(completion!==null && (!exact(completion,${JSON.stringify(completionKeys)},${JSON.stringify(completionKeys)}) ||
  !exact(completion.run_summary,${JSON.stringify(summaryKeys)},${JSON.stringify(summaryKeys)}) ||
  typeof completion.updated!=='boolean' || typeof completion.finished_now!=='boolean' ||
  completion.updated!==completion.finished_now || !uuid(completion.run_id) || completion.run_id!==j.run_id ||
  !identifier(completion.apify_run_id) || !['SUCCEEDED','FAILED','TIMED_OUT','ABORTED'].includes(completion.status) ||
  (completion.dataset_id!==null && (typeof completion.dataset_id!=='string' || completion.dataset_id.length>200)) ||
  (completion.status==='SUCCEEDED' && (typeof completion.dataset_id!=='string' || !completion.dataset_id.trim())) ||
  !Array.isArray(completion.account_ids) || completion.account_ids.length!==1 || !uuid(completion.account_ids[0]) ||
  completion.normalizer_version!=='smoke_website_stub.v1' || !/^[a-f0-9]{64}$/.test(completion.groups_sha256) ||
  !Array.isArray(completion.new_item_ids) || completion.new_item_ids.some(id=>!uuid(id)) ||
  !Number.isInteger(completion.items_seen) || completion.items_seen<0 || completion.items_seen>1 ||
  !Number.isInteger(completion.items_new) || completion.items_new<0 || completion.items_new>completion.items_seen ||
  completion.new_item_ids.length!==completion.items_new ||
  (completion.status==='SUCCEEDED' ? completion.accounts_ok!==1 || completion.accounts_failed!==0 :
    completion.accounts_ok!==0 || completion.accounts_failed!==1 || completion.items_seen!==0 || completion.items_new!==0) ||
  !Array.isArray(completion.cost_keys) || completion.cost_keys.length!==1 ||
  completion.cost_keys[0]!=='apify:'+completion.apify_run_id+':'+completion.account_ids[0])) invalid();
const error=j.error==null?null:['workflow_failed','callback_retryable','apify_failed','unexpected_error'].includes(j.error)?j.error:'workflow_failed';
return [{json:{params:[j.run_id,j.status,error,completion?.apify_run_id ?? null],completion}}];`;

const checkCompletionCode = `const bad=()=>{throw new Error('EMR_N8N_COMPLETION_INVALID');};
const p=$('Prepare finish').first().json;
const rows=$input.all();
if(rows.length!==1) bad();
const r=rows[0].json.r;
const keys=${JSON.stringify(summaryKeys)};
if(!r || typeof r!=='object' || Array.isArray(r) || Object.keys(r).length!==keys.length ||
  !keys.every(k=>Object.hasOwn(r,k)) || r.run_id!==p.params[0] || r.status!==p.params[1] ||
  !['accounts_total','accounts_ok','accounts_failed','items_seen','items_new'].every(k=>Number.isInteger(r[k]) && r[k]>=0) ||
  !Number.isFinite(r.cost_usd) || r.cost_usd<0 || r.items_new>r.items_seen) bad();
const c=p.completion;
const durable=rows[0].json.durable;
const receiptKeys=${JSON.stringify(completionKeys)};
if(c && (!durable || typeof durable!=='object' || Array.isArray(durable) ||
  durable.updated!==true || durable.finished_now!==true ||
  Object.keys(durable).length!==receiptKeys.length || !receiptKeys.every(k=>Object.hasOwn(durable,k)) ||
  !receiptKeys.filter(k=>!['updated','finished_now','run_summary'].includes(k)).every(k=>JSON.stringify(c[k])===JSON.stringify(durable[k])) ||
  !keys.every(k=>c.run_summary[k]===r[k] && durable.run_summary?.[k]===r[k]) || c.items_seen!==r.items_seen || c.items_new!==r.items_new ||
  c.accounts_ok!==r.accounts_ok || c.accounts_failed!==r.accounts_failed || c.cost_usd!==r.cost_usd ||
  c.new_item_ids.length!==r.items_new || r.accounts_total!==c.account_ids.length ||
  (c.status==='SUCCEEDED'?'success':'partial')!==r.status)) bad();
const first=c!==null && c.finished_now===true;
return [{json:{summary:r,dispatch_ai:first && r.items_new>0,dispatch_publish:first && r.items_new>0 && r.status!=='failed'}}];`;

export function booleanIf(key, name, expression, position) {
  return node(
    key,
    name,
    'if',
    {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        combinator: 'and',
        conditions: [
          {
            id: nodeId(key, name + '-condition'),
            leftValue: expression,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
      },
      options: {},
    },
    position,
  );
}
export function execute(bindings, key, name, target, fields, values, wait, position) {
  return node(
    key,
    name,
    'executeWorkflow',
    {
      source: 'database',
      mode: 'once',
      workflowId: { __rl: true, mode: 'id', value: ref(bindings, target).id },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: values,
        matchingColumns: [],
        schema: fields.map(([name, type]) => ({
          id: name,
          displayName: name,
          required: false,
          defaultMatch: false,
          display: true,
          canBeUsedToMatch: true,
          type,
          removed: false,
        })),
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: { waitForSubWorkflow: wait },
    },
    position,
  );
}

export function buildSharedWorkflows(input) {
  const b = parseN8nBindings(input);
  if (!b.credentials?.postgres) throw new Error('EMR_N8N_BINDING_MISSING');
  const startKey = 'SUB-START',
    costKey = 'SUB-COST',
    notifyKey = 'SUB-NOTIFY',
    finishKey = 'SUB-FINISH';
  const ingestKey = 'SUB-INGEST';
  const start = blueprint(
    b,
    startKey,
    [
      trigger(startKey, [
        ['workflow', 'string'],
        ['platform', 'any'],
        ['mode', 'string'],
        ['env', 'string'],
      ]),
      code(startKey, 'Prepare start', startCode, [240, 0]),
      postgres(
        b,
        startKey,
        'Start run',
        'select ops.start_run($1, $2::app.platform, $3, $4, $5) as run_id;',
        '={{ $json.params }}',
        [480, 0],
      ),
    ],
    line('When called', 'Prepare start', 'Start run'),
    [],
    { retryBoundary: 'No automatic Start retry: ambiguous response requires run-history reconciliation' },
  );
  const cost = blueprint(
    b,
    costKey,
    [
      trigger(costKey, [
        ['entries', 'array'],
        ['env', 'string'],
      ]),
      code(costKey, 'Prepare costs', costCode, [240, 0]),
      postgres(
        b,
        costKey,
        'Log costs',
        'select ops.log_cost($1::jsonb) as inserted;',
        '={{ $json.params }}',
        [480, 0],
      ),
    ],
    line('When called', 'Prepare costs', 'Log costs'),
  );
  const ingest = blueprint(
    b,
    ingestKey,
    [
      trigger(ingestKey, [
        ['apify_run_id', 'string'],
        ['status', 'string'],
        ['dataset_id', 'any'],
        ['usage_usd', 'number'],
        ['groups', 'array'],
        ['env', 'string'],
      ]),
      code(ingestKey, 'Prepare atomic callback', ingestCode, [240, 0]),
      postgres(
        b,
        ingestKey,
        'Persist atomic callback',
        'select ops.process_apify_run($1, $2, $3, $4::numeric, $5::jsonb) as r;',
        '={{ $json.params }}',
        [480, 0],
      ),
      code(
        ingestKey,
        'Return durable callback',
        `const rows=$input.all();
if(rows.length!==1 || !rows[0].json.r || typeof rows[0].json.r!=='object' || Array.isArray(rows[0].json.r) ||
  typeof rows[0].json.r.updated!=='boolean' || typeof rows[0].json.r.finished_now!=='boolean' ||
  rows[0].json.r.normalizer_version!=='smoke_website_stub.v1') throw new Error('EMR_N8N_COMPLETION_INVALID');
return [{json:rows[0].json.r}];`,
        [720, 0],
      ),
    ],
    line('When called', 'Prepare atomic callback', 'Persist atomic callback', 'Return durable callback'),
    [],
    { persistence: 'one atomic M03 RPC; caller authenticated Apify readback remains required' },
  );
  const notify = blueprint(
    b,
    notifyKey,
    [
      trigger(notifyKey, notifyFields),
      code(notifyKey, 'Prepare notification', notifyCode, [240, 0]),
      postgres(
        b,
        notifyKey,
        'Log notification',
        'select ops.log_workflow_error($1::jsonb) as logged;',
        '={{ $json.params }}',
        [480, 0],
      ),
      code(
        notifyKey,
        'Return notification',
        "return [{json:{mode:'log',logged:true,sent:false}}];",
        [720, 0],
      ),
    ],
    line('When called', 'Prepare notification', 'Log notification', 'Return notification'),
    [],
    { notificationMode: 'log' },
  );
  const stubFields = [
    ['mode', 'string'],
    ['limit', 'number'],
    ['result_type', 'string'],
    ['env', 'string'],
  ];
  const finish = blueprint(
    b,
    finishKey,
    [
      trigger(finishKey, [
        ['run_id', 'string'],
        ['status', 'string'],
        ['error', 'any'],
        ['completion', 'any'],
        ['env', 'string'],
      ]),
      code(finishKey, 'Prepare finish', finishCode, [240, 0]),
      postgres(
        b,
        finishKey,
        'Finish run',
        "select case when $4::text is null then ops.finish_run($1::uuid, $2, $3) else ops.get_apify_run($4)->'processing_result'->'run_summary' end as r, case when $4::text is null then null::jsonb else ops.get_apify_run($4)->'processing_result' end as durable;",
        '={{ $json.params }}',
        [480, 0],
      ),
      code(finishKey, 'Validate completion', checkCompletionCode, [720, 0]),
      booleanIf(finishKey, 'Dispatch AI?', '={{ $json.dispatch_ai }}', [960, 0]),
      execute(
        b,
        finishKey,
        'Call AI stub',
        'WF-30',
        stubFields,
        { mode: 'manual', limit: null, result_type: null, env: 'dev' },
        false,
        [1200, -100],
      ),
      booleanIf(
        finishKey,
        'Dispatch publish?',
        "={{ $('Validate completion').first().json.dispatch_publish }}",
        [1440, 0],
      ),
      execute(
        b,
        finishKey,
        'Call publish stub',
        'WF-70',
        [...stubFields, ['tags', 'array']],
        { mode: 'manual', limit: null, result_type: null, env: 'dev', tags: ['feed', 'stats'] },
        false,
        [1680, -100],
      ),
      code(
        finishKey,
        'Return summary',
        "return [{json:$('Validate completion').first().json.summary}];",
        [1920, 0],
      ),
    ],
    {
      ...line('When called', 'Prepare finish', 'Finish run', 'Validate completion', 'Dispatch AI?'),
      'Dispatch AI?': { main: [[edge('Call AI stub')], [edge('Dispatch publish?')]] },
      'Call AI stub': { main: [[edge('Dispatch publish?')]] },
      'Dispatch publish?': { main: [[edge('Call publish stub')], [edge('Return summary')]] },
      'Call publish stub': { main: [[edge('Return summary')]] },
    },
    ['WF-30', 'WF-70'],
    { dispatchGuarantee: 'at-least-once; M03 stubs only; durable downstream outbox remains a future gate' },
  );
  return [start, finish, ingest, cost, notify];
}

export function buildErrorHandler(input) {
  const b = parseN8nBindings(input),
    key = 'WF-90';
  const sources = [
    ...collectorStubSpecs.map((s) => s.key),
    'SUB-START',
    'SUB-FINISH',
    'SUB-INGEST',
    'SUB-COST',
    'SUB-NOTIFY',
  ];
  for (const source of sources) ref(b, source);
  const lookup = Object.fromEntries(
    Object.entries(b.workflowRefs)
      .filter(([k]) => k !== 'WF-90')
      .map(([k, v]) => [v.id, k]),
  );
  const classify =
    inputPrelude +
    `const mapping=${JSON.stringify(lookup)};
const source=j.workflow?.id;
if(typeof source!=='string' || !Object.hasOwn(mapping,source)) throw new Error('EMR_N8N_ERROR_SOURCE_UNKNOWN');
const workflow=mapping[source];
let execution=String(j.execution?.id ?? ''),errorNode='Workflow',message=workflow==='WF-19'?'callback_retryable':'workflow_failed';
if(!execution) {
  // Native activation/trigger failures have no originating execution ID.
  // Correlate with this actual error-handler execution instead, explicitly
  // marked in the stored ID/node; never infer an originating run or execution.
  const handler=String($execution.id ?? '');
  if(!object(j.trigger) || !/^[A-Za-z0-9_-]{1,128}$/.test(handler))
    throw new Error('EMR_N8N_ERROR_CORRELATION_UNAVAILABLE');
  execution='handler-'+handler;
  errorNode='Trigger activation';message='workflow_failed';
}
if(!identifier(execution)) invalid();
// No unverified run_id/customData inference; callback execution errors remain retryable.
const audit={kind:'error',workflow,execution_id:execution,node:errorNode,message};
return [{json:{workflow,execution_id:execution,params:[JSON.stringify(audit)]}}];`;
  const prepareNotify = `const items=$input.all();
if(items.length!==1 || !Number.isInteger(items[0].json.error_count) || items[0].json.error_count<0) throw new Error('EMR_N8N_INPUT_INVALID');
if(items[0].json.error_count<3) return [];
const origin=$('Classify error').first().json;
return [{json:{to:['mohamed.abdelrahman@everyone.film'],subject:'Market Radar workflow failure',html:'',text:'',
  workflow:origin.workflow,execution_id:origin.execution_id,env:'dev'}}];`;
  return blueprint(
    b,
    key,
    [
      node(key, 'On workflow error', 'errorTrigger', {}, [0, 0]),
      code(key, 'Classify error', classify, [240, 0]),
      postgres(
        b,
        key,
        'Log classified error',
        'select ops.log_workflow_error($1::jsonb) as logged;',
        '={{ $json.params }}',
        [480, 0],
      ),
      postgres(
        b,
        key,
        'Claim notification',
        'select ops.error_count_24h($1, $2) as error_count;',
        "={{ [$('Classify error').first().json.workflow, true] }}",
        [720, 0],
      ),
      code(key, 'Prepare threshold notification', prepareNotify, [960, 0]),
      execute(
        b,
        key,
        'Call log-only Notify',
        'SUB-NOTIFY',
        notifyFields,
        Object.fromEntries(notifyFields.map(([name]) => [name, `={{ $json.${name} }}`])),
        true,
        [1200, 0],
      ),
    ],
    line(
      'On workflow error',
      'Classify error',
      'Log classified error',
      'Claim notification',
      'Prepare threshold notification',
      'Call log-only Notify',
    ),
    [...sources, 'SUB-NOTIFY'],
    {
      runCorrelation: 'unverified; no parent-run mutation',
      activationCorrelation:
        'handler-<actual native handler execution ID>; no originating execution ID claimed',
      notificationGuarantee: 'atomic six-hour audit claim; no external email sent',
      retryBoundary: 'No automatic notification-claim retry: ambiguous claim requires audit readback',
    },
  );
}
