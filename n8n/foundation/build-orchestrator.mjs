import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { dispatchSlot } from '../../packages/shared/src/n8n-schedule.ts';
import { node, nodeId, code, postgres, blueprint, edge, execute } from './build-foundation.mjs';

// Native JSON preparation only; never an imported workflow or hosted export.
// Pinned 2.43.5 schemas, checked against the actual core-node probe:
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Switch/V3/SwitchV3.node.ts
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts
// Wait documentation establishes DB offloading, not the complete interaction
// with this Cloud workflow's timeout. Use an independent 07:30 clock instead:
// https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/
const key = 'WF-00';
const rules = [
  { slot: 'web_map', hour: 1, minute: 0 },
  { slot: 'vimeo', hour: 2, minute: 0 },
  { slot: 'ig_posts', hour: 2, minute: 30 },
  { slot: 'ig_reels', hour: 3, minute: 0 },
  { slot: 'youtube', hour: 3, minute: 30 },
  { slot: 'li_posts', hour: 4, minute: 0 },
  { slot: 'removal', hour: 4, minute: 0, weekday: 'Sat' },
  { slot: 'li_employees', hour: 5, minute: 0, weekday: 'Sun' },
  { slot: 'stories_am', hour: 6, minute: 0 },
  { slot: 'linker', hour: 6, minute: 30 },
  { slot: 'news', hour: 7, minute: 0, weekday: 'Sun' },
  { slot: 'awards', hour: 7, minute: 30, weekday: 'Sun' },
  { slot: 'briefs', hour: 8, minute: 0, weekday: 'Mon' },
  { slot: 'digest', hour: 9, minute: 0 },
  { slot: 'health', hour: 9, minute: 15 },
];
const slots = [...rules.map((r) => r.slot), 'stories_pm', 'backfill_wave'];
const news = dispatchSlot('news').calls;
if (
  news.length !== 2 ||
  news[0].workflow !== 'WF-22' ||
  news[0].delayMinutes !== 0 ||
  news[1].workflow !== 'WF-23' ||
  news[1].delayMinutes !== 30 ||
  slots
    .filter((slot) => slot !== 'news' && slot !== 'awards')
    .some((slot) => dispatchSlot(slot).calls.some((c) => c.delayMinutes !== 0))
)
  throw new Error('EMR_N8N_SCHEDULE_PLAN_MISMATCH');
const routes = Object.fromEntries(
  slots
    .filter((s) => s !== 'awards')
    .map((slot) => [
      slot,
      dispatchSlot(slot)
        .calls.filter((c) => c.delayMinutes === 0)
        .map((c) => ({
          target: c.workflow,
          input: { ...c.input, result_type: c.input.result_type ?? null },
        })),
    ]),
);
routes.awards = news
  .filter((c) => c.delayMinutes === 30)
  .map((c) => ({ target: c.workflow, input: { ...c.input, result_type: c.input.result_type ?? null } }));
const targets = [
  ...new Set(
    Object.values(routes)
      .flat()
      .map((c) => c.target),
  ),
];
const fields = [
  ['mode', 'string'],
  ['limit', 'number'],
  ['result_type', 'string'],
  ['env', 'string'],
];

function clockExpressions() {
  const clocks = new Map();
  for (const rule of rules) {
    const clock = `${rule.hour}:${rule.minute}`;
    const existing = clocks.get(clock);
    if (!existing || !rule.weekday) clocks.set(clock, rule);
    else if (existing.weekday && existing.weekday !== rule.weekday)
      throw new Error('EMR_N8N_CLOCK_RULE_CONFLICT');
  }
  const weekdays = { Sun: 0, Mon: 1, Sat: 6 };
  return [...clocks.values()].map((rule) => ({
    field: 'cronExpression',
    expression: `0 ${rule.minute} ${rule.hour} * * ${rule.weekday ? weekdays[rule.weekday] : '*'}`,
  }));
}

function schedule(name, interval, position, disabled = false) {
  return {
    ...node(
      key,
      name,
      'scheduleTrigger',
      { rule: { interval }, misfirePolicy: 'skip', misfireGraceSeconds: 0 },
      position,
    ),
    ...(disabled ? { disabled: true } : {}),
  };
}

const dispatchCode = `const invalid=()=>{throw new Error('EMR_N8N_INPUT_INVALID');};
const items=$input.all();
if(items.length!==1)invalid();
const j=items[0].json;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
if(!object(j)||j.env!=='dev'||j.backfill_enabled!==false||j.stories_twice_daily!==false||
  j.app_url!==''||j.webhook_base!=='https://muhhammedsayed.app.n8n.cloud'||j.notify_mode!=='log'||!object(j.input))invalid();
const input=j.input;
if(Object.keys(input).some(k=>!['timestamp','slot_override','env'].includes(k))||
  (input.env!==null&&input.env!==undefined&&input.env!=='dev'))invalid();
function timestamp(value){
  if(typeof value!=='string')invalid();
  const m=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,9})?(Z|[+-]\\d{2}:\\d{2})$/.exec(value);
  if(!m)invalid();
  const [y,month,d,h,minute,s]=m.slice(1,7).map(Number);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||month<1||month>12||d<1||d>days[month-1]||h>23||minute>59||s>59)invalid();
  if(m[7]!=='Z'){
    const [oh,om]=m[7].slice(1).split(':').map(Number);
    if(oh>14||om>59||(oh===14&&om!==0))invalid();
  }
  const date=new Date(value);if(!Number.isFinite(date.getTime()))invalid();return date;
}
const date=input.timestamp===null||input.timestamp===undefined?null:timestamp(input.timestamp);
const routes=${JSON.stringify(routes, null, 2)};
const rules=${JSON.stringify(rules, null, 2)};
const unknown=()=>{
  const execution=String($execution.id??'');
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(execution))invalid();
  return [{json:{target:'audit',audit_reason:'unknown_schedule_slot',params:[JSON.stringify({
    kind:'error',workflow:'WF-00',execution_id:execution,node:'Unknown schedule slot',message:'unexpected_error'
  })]}}];
};
let selected=[];
if(input.slot_override!==null&&input.slot_override!==undefined){
  const slot=input.slot_override;
  if(typeof slot!=='string'||slot.length<1||slot.length>100)invalid();
  if(!Object.hasOwn(routes,slot))return unknown();
  selected=[slot];
}else if(date!==null){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const part=name=>parts.find(p=>p.type===name)?.value;
  selected=rules.filter(r=>r.hour===Number(part('hour'))&&r.minute===Number(part('minute'))&&(!r.weekday||r.weekday===part('weekday'))).map(r=>r.slot);
}else return unknown();
return selected.flatMap(slot=>routes[slot].map(call=>({json:call})));`;

export function buildOrchestrator(input) {
  const bindings = parseN8nBindings(input);
  const configFields = [
    ['env', 'string', 'dev'],
    ['app_url', 'string', ''],
    ['webhook_base', 'string', 'https://muhhammedsayed.app.n8n.cloud'],
    ['notify_mode', 'string', 'log'],
    ['stories_twice_daily', 'boolean', false],
    ['backfill_enabled', 'boolean', false],
    [
      'input',
      'object',
      '={{ { timestamp: $json.timestamp ?? null, slot_override: $json.slot_override ?? null, env: $json.env ?? null } }}',
    ],
  ];
  const nodes = [
    schedule('Cairo clock', clockExpressions(), [0, 0]),
    schedule(
      'PM stories (disabled)',
      [{ field: 'cronExpression', expression: '0 0 18 * * *' }],
      [0, 200],
      true,
    ),
    schedule(
      'Backfill waves (disabled)',
      [{ field: 'cronExpression', expression: '0 0 10-23 * * *' }],
      [0, 400],
      true,
    ),
    node(key, 'Manual slot test', 'manualTrigger', {}, [0, 600]),
    node(
      key,
      'Config',
      'set',
      {
        mode: 'manual',
        includeOtherFields: false,
        assignments: {
          assignments: configFields.map(([name, type, value]) => ({
            id: nodeId(key, `config-${name}`),
            name,
            type,
            value,
          })),
        },
        options: {},
      },
      [260, 0],
    ),
    code(key, 'Which slot?', dispatchCode, [500, 0]),
    node(
      key,
      'Route child',
      'switch',
      {
        mode: 'rules',
        rules: {
          values: [...targets, 'audit'].map((target) => ({
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
              combinator: 'and',
              conditions: [
                {
                  id: nodeId(key, `route-${target}`),
                  leftValue: '={{ $json.target }}',
                  rightValue: target,
                  operator: { type: 'string', operation: 'equals' },
                },
              ],
            },
            renameOutput: true,
            outputKey: target,
          })),
        },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'Invalid dispatch' },
      },
      [740, 0],
    ),
    ...targets.map((target, i) => ({
      ...execute(
        bindings,
        key,
        `Call ${target}`,
        target,
        fields,
        Object.fromEntries(fields.map(([name]) => [name, `={{ $json.input.${name} }}`])),
        false,
        [1000, i * 160],
      ),
      retryOnFail: false,
    })),
    postgres(
      bindings,
      key,
      'Audit unknown slot',
      'select ops.log_workflow_error($1::jsonb) as logged;',
      '={{ $json.params }}',
      [1000, targets.length * 160],
    ),
    code(key, 'Reject invalid dispatch', "throw new Error('EMR_N8N_DISPATCH_INVALID');", [
      1000,
      (targets.length + 1) * 160,
    ]),
  ];
  const connections = {
    ...Object.fromEntries(
      ['Cairo clock', 'PM stories (disabled)', 'Backfill waves (disabled)', 'Manual slot test'].map(
        (name) => [name, { main: [[edge('Config')]] }],
      ),
    ),
    Config: { main: [[edge('Which slot?')]] },
    'Which slot?': { main: [[edge('Route child')]] },
    'Route child': {
      main: [
        ...targets.map((target) => [edge(`Call ${target}`)]),
        [edge('Audit unknown slot')],
        [edge('Reject invalid dispatch')],
      ],
    },
  };
  return blueprint(bindings, key, nodes, connections, targets, {
    scheduleDeviation: {
      kind: 'separate-news-awards-clocks',
      sharedLogicalPlanPreserved: true,
      nativeNews: 'Sunday07:00 Cairo → WF-22',
      nativeAwards: 'Sunday07:30 Cairo → WF-23',
      manualNewsIncludesAwards: false,
      waitNodeUsed: false,
      reason: 'Keep the reviewed900second workflow timeout without assuming Wait/timeout semantics',
    },
    featureGateBoundary:
      'PM stories and backfill trigger nodes disabled; Configfalse hard gate. Database flags alone cannot enable them. No settings/Variables values read.',
    auditBoundary:
      'Unknown manual slot is dropped; fixed Unknown schedule slot node / unexpected_error message via the existing idempotent logger. No raw slot stored.',
    retryBoundary: 'Child dispatch has no automatic retry; reconcile an ambiguous child start before replay',
  });
}
