import { buildNativeCallback, parseCollectorTransport } from './build-native-collectors.mjs';
import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { node, code, edge, line, booleanIf } from '../foundation/build-foundation.mjs';
import { collectorRequestId } from './native-runtime.mjs';

/** Extend the maintained native callback with a single website thin-page retry.
 * All paid authority remains the existing restricted launch receipt. A lost
 * start acknowledgement stops; a duplicate callback never authorizes POST again.
 */
export function buildNativeM05Callback(bindings, transport, errorWorkflowId) {
  const b = parseN8nBindings(bindings),
    c = parseCollectorTransport(transport),
    result = buildNativeCallback(b, c, errorWorkflowId);
  const w = result.workflow,
    key = 'WF-19';
  const classification = w.nodes.find((n) => n.name === 'Check callback classification');
  classification.parameters.jsCode = classification.parameters.jsCode.replace(
    "['m04','foundation','unknown']",
    "['m04','m05','foundation','unknown']",
  );
  w.nodes.find((n) => n.name === 'M04 registered callback?').parameters.conditions.conditions[0].leftValue =
    "={{ ['m04','m05'].includes($json.scope) }}";
  const receipt = w.nodes.find((n) => n.name === 'Verify M04 callback receipt');
  receipt.parameters.jsCode = receipt.parameters.jsCode.replace(
    "['pending','completed']",
    "['pending','completed','retry_required']",
  );
  receipt.parameters.jsCode = receipt.parameters.jsCode.replace(
    "const prior=$('Prepare M04 callback processing').item.json,b=j.body;",
    "const prior=$('Prepare M04 callback processing').item.json,b=j.body;if(b?.result?.requires_review===true)throw Error('M05_SOURCE_BOUNDARY_RECONCILED');",
  );
  const one =
    "const rows=$input.all();if(rows.length!==1)throw Error('M05_CALLBACK_INVALID');const j=rows[0].json;\n";
  const http = (name, service, url, body, pos) => {
    const auth =
      service === 'gateway'
        ? {
            parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth' },
            credentials: { httpCustomAuth: { id: c.credential.id, name: c.credential.name } },
          }
        : httpCredentialBinding(b, 'apify');
    return {
      ...node(
        key,
        name,
        'httpRequest',
        {
          method: 'POST',
          url,
          ...auth.parameters,
          sendQuery: false,
          sendHeaders: false,
          sendBody: true,
          specifyBody: 'json',
          jsonBody: body,
          options: {
            timeout: 60000,
            allowUnauthorizedCerts: false,
            redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
            sendCredentialsOnCrossOriginRedirect: false,
            response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
          },
        },
        pos,
      ),
      credentials: auth.credentials,
      retryOnFail: false,
      onError: 'continueRegularOutput',
    };
  };
  const wh = encodeURIComponent(
    Buffer.from(
      JSON.stringify([
        {
          eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
          requestUrl: b.instanceUrl + '/webhook/emr-apify-callback',
        },
      ]),
    ).toString('base64'),
  );
  w.nodes.push(
    booleanIf(
      key,
      'M05 thin retry required?',
      "={{ $json.completion?.state === 'retry_required' }}",
      [2000, -400],
    ),
    code(
      key,
      'Prepare owned thin retry',
      one +
        collectorRequestId.toString() +
        `\nconst r=j.completion?.retry;if(!r||r.actor_id!=='apify/website-content-crawler'||r.crawler_type!=='playwright:adaptive'||r.account_ids?.length!==1||!Array.isArray(r.urls)||!r.urls.length||r.urls.length>200||r.urls.length!==r.results_limit||r.actor_input?.crawlerType!=='playwright:adaptive'||r.actor_input?.ignoreHttpsErrors!==false||r.actor_input?.maxSessionRotations!==0)throw Error('M05_RETRY_INVALID');return[{json:{...j,retry:r,request:{version:1,requestId:collectorRequestId(String($execution.id),100),operation:'m05.launch',args:r}}}];`,
      [2200, -400],
    ),
    http(
      'Admit exact thin retry',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [2400, -400],
    ),
    code(
      key,
      'Verify thin retry permit',
      one +
        `const p=$('Prepare owned thin retry').item.json,b=j.body;if(j.statusCode!==200||b?.version!==1||b.requestId!==p.request.requestId||b.operation!=='m05.launch'||!b.result)throw Error('M05_RETRY_RECONCILIATION_REQUIRED');const d=b.result.descriptor;if(b.result.permit===false){if(!/^[A-Za-z0-9_-]{1,128}$/.test(b.result.apify_run_id??''))throw Error('M05_RETRY_START_UNKNOWN');return[{json:{...p,post:false,retry_actor_id:b.result.apify_run_id}}];}if(b.replayed!==false||b.result.permit!==true||!d||d.actorPath!=='apify~website-content-crawler'||d.billingModel!=='PPU'||!/^\\d+\\.\\d+\\.\\d+$/.test(d.build??'')||d.memory!==1024||d.timeout!==600||d.maxItems!==p.retry.results_limit)throw Error('M05_RETRY_INVALID_PERMIT');return[{json:{...p,post:true,descriptor:d}}];`,
      [2600, -400],
    ),
    booleanIf(key, 'Fresh retry POST permitted?', '={{ $json.post === true }}', [2800, -400]),
    http(
      'Start bounded adaptive retry',
      'apify',
      '={{ "https://api.apify.com/v2/acts/apify~website-content-crawler/runs?waitForFinish=0&restartOnError=false&timeout=600&memory=1024&build="+encodeURIComponent($json.descriptor.build)+"&maxTotalChargeUsd="+$json.descriptor.maxTotalChargeUsd+"&webhooks=' +
        wh +
        '" }}',
      '={{ $json.retry.actor_input }}',
      [3000, -600],
    ),
    code(
      key,
      'Prepare retry registration',
      one +
        collectorRequestId.toString() +
        `\nconst p=$('Verify thin retry permit').item.json;let id=p.retry_actor_id,capAcknowledged=true;if(p.post){if(j.statusCode!==201||!/^[A-Za-z0-9_-]{1,128}$/.test(j.body?.data?.id??''))throw Error('M05_RETRY_START_UNKNOWN');id=j.body.data.id;capAcknowledged=j.body.data.options?.maxTotalChargeUsd===p.descriptor.maxTotalChargeUsd&&j.body.data.options?.isMaxTotalChargeUsdSetByUser===true;}const r=p.retry;return[{json:{...p,capAcknowledged,request:{version:1,requestId:collectorRequestId(String($execution.id),101),operation:'m05.register',args:{run_id:r.run_id,launch_id:r.launch_id,apify_run_id:id,actor_id:r.actor_id,pass:'primary',account_ids:r.account_ids,purpose:r.purpose}}}}];`,
      [3200, -400],
    ),
    http(
      'Register bounded adaptive retry',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [3400, -400],
    ),
    code(
      key,
      'Verify retry registration',
      one +
        `const p=$('Prepare retry registration').item.json,b=j.body;if(j.statusCode!==200||b?.requestId!==p.request.requestId||b.operation!=='m05.register'||b.result?.registered!==true||b.result.apify_run_id!==p.request.args.apify_run_id)throw Error('M05_RETRY_REGISTRATION_UNKNOWN');if(p.capAcknowledged===false)throw Error('M05_RETRY_CAP_UNACKNOWLEDGED');return[{json:{apify_run_id:p.apify_run_id,transport:p.transport,accepted:true,replayed:!p.post,completion:{state:'retry_registered'},pending:false}}];`,
      [3600, -400],
    ),
  );
  w.connections['M04 dataset pages pending?'].main[1] = [edge('M05 thin retry required?')];
  Object.assign(w.connections, {
    'M05 thin retry required?': {
      main: [[edge('Prepare owned thin retry')], [edge('M04 webhook response?')]],
    },
    ...line(
      'Prepare owned thin retry',
      'Admit exact thin retry',
      'Verify thin retry permit',
      'Fresh retry POST permitted?',
    ),
    'Fresh retry POST permitted?': {
      main: [[edge('Start bounded adaptive retry')], [edge('Prepare retry registration')]],
    },
    ...line(
      'Start bounded adaptive retry',
      'Prepare retry registration',
      'Register bounded adaptive retry',
      'Verify retry registration',
      'M04 webhook response?',
    ),
  });
  return {
    ...result,
    requiredRefs: { ...result.requiredRefs, credentialKeys: ['foundationGateway', 'apify'] },
    m05: true,
    hostedAcceptance: false,
  };
}
