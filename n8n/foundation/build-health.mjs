import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  node,
  trigger,
  code,
  postgres,
  blueprint,
  line,
  edge,
  execute,
  booleanIf,
  inputPrelude,
} from './build-foundation.mjs';

// Native inactive blueprint only. Core parameter contracts are the pinned,
// observed n8n@2.43.5 contracts used by build-foundation.mjs. No runtime calls.
const standardFields = [
  ['mode', 'string'],
  ['limit', 'number'],
  ['result_type', 'string'],
  ['env', 'string'],
];
const notifyFields = [
  ['to', 'array'],
  ['subject', 'string'],
  ['html', 'string'],
  ['text', 'string'],
  ['workflow', 'string'],
  ['execution_id', 'string'],
  ['env', 'string'],
];
const validateInput =
  inputPrelude +
  `
if(!exact(j,['mode','limit','result_type','env'])) invalid();
const mode=j.mode??'manual',limit=j.limit??null,result_type=j.result_type??null;
if(!['daily','manual'].includes(mode) || (limit!==null && (!Number.isInteger(limit)||limit<1||limit>1000)) ||
  (result_type!==null && (typeof result_type!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(result_type)))) invalid();
return [{json:{mode,limit,result_type,env:'dev'}}];`;

const guardCode = `const bad=()=>{throw new Error('EMR_N8N_HEALTH_INVALID');};
const rows=$input.all();
if(rows.length!==1) bad();
const j=rows[0].json;
if(typeof j.stats_daily_enabled!=='boolean' || typeof j.cairo_yesterday!=='string' ||
  !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(j.cairo_yesterday)) bad();
const execution_id=String($execution.id??'');
if(!/^[A-Za-z0-9_-]{1,128}$/.test(execution_id)) bad();
return [{json:{stats_daily_enabled:j.stats_daily_enabled,cairo_yesterday:j.cairo_yesterday,execution_id}}];`;

const healthCode = `const bad=()=>{throw new Error('EMR_N8N_HEALTH_INVALID');};
const rows=$input.all(),guard=$('Validate health guard').first().json;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const count=x=>Number.isSafeInteger(x)&&x>=0;
const money=x=>Number.isFinite(x)&&x>=0;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const nullableString=x=>x===null||typeof x==='string';
const platforms=['vimeo','instagram','instagram_stories','website','website_work_page','linkedin','linkedin_employees','youtube','news'];
const providers=['apify','openai','serpapi','firecrawl','vimeo','youtube','n8n','supabase','vercel','email','other'];
if(rows.length!==1 || rows[0].json.cairo_yesterday!==guard.cairo_yesterday) bad();
const h=rows[0].json.h;
if(!exact(h,['failing_accounts','stale_accounts','queues','items_new_yesterday','cost_yesterday','budget',
  'month_to_date_usd','forecast_month_usd','workflow_errors_24h']) ||
  !Array.isArray(h.failing_accounts) || !Array.isArray(h.stale_accounts) ||
  !exact(h.queues,['ai_extract','embed','media']) || !Object.values(h.queues).every(count) ||
  !object(h.items_new_yesterday) || !Object.entries(h.items_new_yesterday).every(([p,n])=>platforms.includes(p)&&count(n)) ||
  !exact(h.cost_yesterday,['total','by_provider']) || !money(h.cost_yesterday.total) || !object(h.cost_yesterday.by_provider) ||
  !Object.entries(h.cost_yesterday.by_provider).every(([p,n])=>providers.includes(p)&&money(n)) ||
  !exact(h.budget,['daily_budget_usd','over_budget']) || !money(h.budget.daily_budget_usd) || typeof h.budget.over_budget!=='boolean' ||
  !money(h.month_to_date_usd) || !money(h.forecast_month_usd) || !object(h.workflow_errors_24h) ||
  !Object.entries(h.workflow_errors_24h).every(([w,n])=>/^[A-Za-z0-9_-]{1,200}$/.test(w)&&count(n))) bad();
for(const a of h.failing_accounts) if(!exact(a,['account_id','competitor','platform','handle','last_error','consecutive_failures']) ||
  !uuid(a.account_id) || typeof a.competitor!=='string' || !platforms.includes(a.platform) ||
  !nullableString(a.handle) || !nullableString(a.last_error) || !count(a.consecutive_failures)) bad();
for(const a of h.stale_accounts) if(!exact(a,['account_id','competitor','platform','handle','last_success_at']) ||
  !uuid(a.account_id) || typeof a.competitor!=='string' || !platforms.includes(a.platform) ||
  !nullableString(a.handle) || !nullableString(a.last_success_at)) bad();
const accrued=$('Accrue yesterday').first().json.accrued;
if(!count(accrued)) bad();
return [{json:{health:h,accrued,cairo_yesterday:guard.cairo_yesterday,execution_id:guard.execution_id,
  over_budget:h.budget.over_budget,has_failing_sources:h.failing_accounts.length>0}}];`;

const healthRef = "$('Validate daily health').first().json";
function notification(bindings, name, suffix, position) {
  return execute(
    bindings,
    'WF-91',
    name,
    'SUB-NOTIFY',
    notifyFields,
    {
      to: ['mohamed.abdelrahman@everyone.film'],
      subject: 'Market Radar daily health',
      html: '',
      text: '',
      workflow: 'WF-91',
      execution_id: `={{ ${healthRef}.execution_id + '-${suffix}' }}`,
      env: 'dev',
    },
    true,
    position,
  );
}
function alert(bindings, name, kind, position) {
  return execute(
    bindings,
    'WF-91',
    name,
    'WF-80',
    [...standardFields, ['kind', 'string']],
    {
      mode: 'daily',
      limit: null,
      result_type: null,
      env: 'dev',
      kind,
    },
    true,
    position,
  );
}

export function buildHealthWorkflow(input) {
  const b = parseN8nBindings(input),
    key = 'WF-91';
  return blueprint(
    b,
    key,
    [
      trigger(key, standardFields),
      node(key, 'Manual test', 'manualTrigger', {}, [0, 200]),
      code(key, 'Validate dev input', validateInput, [240, 0]),
      postgres(
        b,
        key,
        'Read health guard',
        "select ops.get_setting('stats_daily_enabled') as stats_daily_enabled, ((now() at time zone 'Africa/Cairo')::date - 1)::text as cairo_yesterday;",
        '={{ [] }}',
        [480, 0],
      ),
      code(key, 'Validate health guard', guardCode, [720, 0]),
      booleanIf(key, 'Stats refresh enabled?', '={{ $json.stats_daily_enabled }}', [960, 0]),
      code(
        key,
        'Stats refresh unavailable',
        "throw new Error('EMR_N8N_STATS_REFRESH_UNAVAILABLE');",
        [1200, -200],
      ),
      postgres(
        b,
        key,
        'Accrue yesterday',
        'select ops.accrue_fixed_costs($1::date) as accrued;',
        "={{ [$('Validate health guard').first().json.cairo_yesterday] }}",
        [1200, 0],
      ),
      postgres(
        b,
        key,
        'Read daily health',
        "select ops.daily_health() as h, ((now() at time zone 'Africa/Cairo')::date - 1)::text as cairo_yesterday;",
        '={{ [] }}',
        [1440, 0],
      ),
      code(key, 'Validate daily health', healthCode, [1680, 0]),
      booleanIf(key, 'Over budget?', `={{ ${healthRef}.over_budget }}`, [1920, 0]),
      alert(b, 'Call budget alert stub', 'budget', [2160, -100]),
      notification(b, 'Call budget log', 'budget', [2400, -100]),
      booleanIf(key, 'Failing sources?', `={{ ${healthRef}.has_failing_sources }}`, [2640, 0]),
      alert(b, 'Call failing sources stub', 'failing_sources', [2880, -100]),
      notification(b, 'Call failing sources log', 'failing', [3120, -100]),
      notification(b, 'Call daily health log', 'health', [3360, 0]),
      execute(
        b,
        key,
        'Call stats publish stub',
        'WF-70',
        [...standardFields, ['tags', 'array']],
        {
          mode: 'daily',
          limit: null,
          result_type: null,
          env: 'dev',
          tags: ['stats'],
        },
        true,
        [3600, 0],
      ),
      code(
        key,
        'Return health',
        `const r=${healthRef};
return [{json:{health:r.health,accrued:r.accrued,cairo_yesterday:r.cairo_yesterday,notification_mode:'log',sent:false}}];`,
        [3840, 0],
      ),
    ],
    {
      ...line(
        'When called',
        'Validate dev input',
        'Read health guard',
        'Validate health guard',
        'Stats refresh enabled?',
      ),
      'Manual test': { main: [[edge('Validate dev input')]] },
      'Stats refresh enabled?': { main: [[edge('Stats refresh unavailable')], [edge('Accrue yesterday')]] },
      ...line('Accrue yesterday', 'Read daily health', 'Validate daily health', 'Over budget?'),
      'Over budget?': { main: [[edge('Call budget alert stub')], [edge('Failing sources?')]] },
      ...line('Call budget alert stub', 'Call budget log', 'Failing sources?'),
      'Failing sources?': { main: [[edge('Call failing sources stub')], [edge('Call daily health log')]] },
      ...line(
        'Call failing sources stub',
        'Call failing sources log',
        'Call daily health log',
        'Call stats publish stub',
        'Return health',
      ),
    },
    ['WF-80', 'SUB-NOTIFY', 'WF-70'],
    {
      notificationMode: 'log',
      runCorrelation: 'no parent run created or inferred',
      statsRefresh: 'false setting required until M10 RPC exists; true branch fails closed',
      dayBoundary: 'database Cairo yesterday; mid-run Cairo date change aborts notification dispatch',
      fixedFeeCoverage:
        'only dated month-unit prices already known to ops.price_book; unknown fees remain unpriced',
    },
  );
}
