import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { blueprint, code, node, trigger, execute, line } from './build-foundation.mjs';

const prepare = `const bad=()=>{throw new Error('EMR_APIFY_RECOVERY_INPUT_INVALID');};
const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object'||Array.isArray(rows[0].json))bad();
const j=rows[0].json;
if(Object.keys(j).some(k=>!['apify_run_id','env'].includes(k))||(j.env!==undefined&&j.env!=='dev'))bad();
// No POST or start_run is generated while durable spend admission is absent.
if(j.apify_run_id===undefined||j.apify_run_id===null||j.apify_run_id==='')throw new Error('EMR_APIFY_SPEND_ADMISSION_UNAVAILABLE');
if(typeof j.apify_run_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(j.apify_run_id))bad();
return[{json:{apify_run_id:j.apify_run_id,env:'dev',transport:'recovery'}}];`;

export function buildApifySmoke(input) {
  const b = parseN8nBindings(input),
    key = 'WF-99';
  const result = blueprint(
    b,
    key,
    [
      node(key, 'Manual smoke recovery', 'manualTrigger', {}, [0, 0]),
      trigger(key, [
        ['apify_run_id', 'string'],
        ['env', 'string'],
      ]),
      code(key, 'Recover original registered run', prepare, [240, 0]),
      execute(
        b,
        key,
        'Reconcile original callback',
        'WF-19',
        [
          ['apify_run_id', 'string'],
          ['env', 'string'],
          ['transport', 'string'],
        ],
        { apify_run_id: '={{ $json.apify_run_id }}', env: 'dev', transport: 'recovery' },
        true,
        [480, 0],
      ),
    ],
    {
      ...line('When called', 'Recover original registered run', 'Reconcile original callback'),
      'Manual smoke recovery': {
        main: [[{ node: 'Recover original registered run', type: 'main', index: 0 }]],
      },
    },
    ['WF-19'],
    {
      runnableWorkflow: false,
      launchAvailable: false,
      remainingGates: [
        'durable spend admission before any actor POST',
        'exact reviewed live foundation packet',
        'registration of the same known original run before recovery',
        'WF19 dataset privacy/rejection audit/native acceptance gates',
      ],
      recoveryGuarantee:
        'Same original ID only; unknown run stops at WF19 registry gate. Ambiguous launch without an original ID cannot be retried.',
      providerRequests: 0,
    },
  );
  result.requiredRefs.credentialKeys = [];
  return result;
}
