import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { node, code, postgres, line } from './build-foundation.mjs';

// A composable readback slice, deliberately not a runnable WF19/WF99 export.
// No webhook, paid POST, persistence, completion or scheduling is included.
const extractCode = `const items=$input.all(),invalid=()=>{throw new Error('EMR_APIFY_NOTIFICATION_INVALID');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
if(items.length!==1||!object(items[0].json))invalid();
const j=items[0].json.body??items[0].json;
if(!object(j)||!['ACTOR.RUN.SUCCEEDED','ACTOR.RUN.FAILED','ACTOR.RUN.TIMED_OUT','ACTOR.RUN.ABORTED'].includes(j.eventType)||
  !object(j.resource)||typeof j.resource.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(j.resource.id))invalid();
// Every other callback field is untrusted and is discarded here.
return [{json:{apify_run_id:j.resource.id,params:[j.resource.id]}}];`;

const isoDateCode = `const isoDate=value=>{
  if(typeof value!=='string')return false;
  const m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:[.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(value);
  if(!m)return false;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)return false;
  return Number.isFinite(Date.parse(value));
};\n`;

const registryCode =
  isoDateCode +
  `const bad=()=>{throw new Error('EMR_APIFY_REGISTRY_INVALID');};
const rows=$input.all(),id=$('Validate callback ID').first().json.apify_run_id;
if(rows.length!==1)bad();
const r=rows[0].json.registered;
if(r===null)throw new Error('EMR_APIFY_RUN_UNREGISTERED');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
if(!r||typeof r!=='object'||Array.isArray(r)||r.apify_run_id!==id||
  !['apify/website-content-crawler','aYG0l9s7dbB7j3gbS'].includes(r.actor_id)||!uuid(r.run_id)||
  !Array.isArray(r.account_ids)||r.account_ids.length!==1||!uuid(r.account_ids[0])||r.purpose!=='daily'||
  (r.processed_at!==null&&!isoDate(r.processed_at)))bad();
// The final workflow must return the saved full receipt for a replay. This
// component stops before any HTTP instead of pretending to implement it.
if(r.processed_at!==null)throw new Error('EMR_APIFY_REPLAY_REQUIRES_SAVED_RECEIPT');
const registered={apify_run_id:r.apify_run_id,actor_id:r.actor_id,run_id:r.run_id,account_ids:r.account_ids,purpose:r.purpose,processed_at:null};
return [{json:{registered,run_url:'https://api.apify.com/v2/actor-runs/'+id+'?waitForFinish=0'}}];`;

const terminalCode =
  isoDateCode +
  `const bad=()=>{throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');};
const rows=$input.all(),registry=$('Bind registered run').first().json.registered;
if(rows.length!==1||rows[0].json.statusCode!==200)bad();
const d=rows[0].json.body?.data;
if(!d||typeof d!=='object'||Array.isArray(d)||d.id!==registry.apify_run_id||d.actId!=='aYG0l9s7dbB7j3gbS'||
  !['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(d.status)||
  !Number.isFinite(d.usageTotalUsd)||d.usageTotalUsd<0||d.usageTotalUsd>999999.999999||
  !isoDate(d.finishedAt)||
  (d.defaultDatasetId!==undefined&&d.defaultDatasetId!==null&&(typeof d.defaultDatasetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(d.defaultDatasetId)))||
  (d.status==='SUCCEEDED'&&!d.defaultDatasetId))bad();
const terminal={apifyRunId:d.id,parentRunId:registry.run_id,accountId:registry.account_ids[0],actorId:d.actId,
  wireStatus:d.status,status:d.status==='TIMED-OUT'?'TIMED_OUT':d.status,datasetId:d.defaultDatasetId??null,
  usageTotalUsd:d.usageTotalUsd,finishedAt:d.finishedAt};
return [{json:{registered:registry,terminal,observed_at_ms:Date.now(),requiresDelayedReadback:true}}];`;

export function buildCallbackReadbackComponent(input) {
  const b = parseN8nBindings(input),
    key = 'WF-19-READBACK';
  if (!b.credentials?.postgres) throw new Error('EMR_N8N_BINDING_MISSING');
  const auth = httpCredentialBinding(b, 'apify');
  const lookup = {
    ...postgres(
      b,
      key,
      'Read registered run',
      'select ops.get_apify_run($1) as registered;',
      '={{ $json.params }}',
      [240, 0],
    ),
    retryOnFail: false,
  };
  delete lookup.maxTries;
  delete lookup.waitBetweenTries;
  return {
    kind: 'native-json-component',
    runnableWorkflow: false,
    hostedAcceptance: false,
    requiredRefs: { credentialKeys: ['postgres', 'apify'] },
    requestLimit: { databaseSelects: 1, authenticatedRunGets: 1 },
    remainingGates: [
      'webhook and response contract',
      'durable unknown-callback audit',
      'saved-receipt replay branch',
      'bounded delayed cost reread',
      'bounded dataset projection and actual Cloud normalizer support',
      'atomic persistence and finish dispatch',
      'WF99 original-run registration recovery',
      'reviewed spend admission',
    ],
    nodes: [
      code(key, 'Validate callback ID', extractCode, [0, 0]),
      lookup,
      code(key, 'Bind registered run', registryCode, [480, 0]),
      {
        ...node(
          key,
          'Read authenticated terminal run',
          'httpRequest',
          {
            method: 'GET',
            url: '={{ $json.run_url }}',
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
          [720, 0],
        ),
        credentials: auth.credentials,
        retryOnFail: false,
        onError: 'continueRegularOutput',
      },
      code(key, 'Project first terminal snapshot', terminalCode, [960, 0]),
    ],
    connections: line(
      'Validate callback ID',
      'Read registered run',
      'Bind registered run',
      'Read authenticated terminal run',
      'Project first terminal snapshot',
    ),
  };
}
