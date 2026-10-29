import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  nodeId,
  trigger,
  settings,
  tags,
  booleanIf,
  line,
  edge,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';
import { m06StoryRequestId } from './native-m06-stories.mjs';
import { buildM06StoryMediaHandoff } from './m06-story-media-handoff.mjs';

const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0]?.json||typeof rows[0].json!=='object'||Array.isArray(rows[0].json)||rows[0].binary)throw Error('M06_CALLBACK_INPUT_INVALID');const j=rows[0].json;\n";
export function m06CallbackSource(value) {
  const external = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('M06_CALLBACK_INPUT_INVALID');
  if (Object.hasOwn(value, 'body')) {
    const body = value.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'].includes(
        body.eventType,
      ) ||
      !body.resource ||
      typeof body.resource !== 'object' ||
      Array.isArray(body.resource) ||
      !external(body.resource.id)
    )
      throw Error('M06_CALLBACK_INPUT_INVALID');
    return { apify_run_id: body.resource.id, transport: 'webhook' };
  }
  if (
    Object.keys(value).sort().join(',') !== 'apify_run_id,env,transport' ||
    value.env !== 'dev' ||
    value.transport !== 'recovery' ||
    !external(value.apify_run_id)
  )
    throw Error('M06_CALLBACK_INPUT_INVALID');
  return { apify_run_id: value.apify_run_id, transport: 'recovery' };
}
export function m06CallbackAdmission(response, prior) {
  const b = response?.body,
    source = prior?.source;
  if (!source || !prior.request) throw Error('M06_CALLBACK_ADMISSION_INVALID');
  if (response.statusCode !== 200) {
    return { ...source, accepted: false, statusCode: response.statusCode === 403 ? 403 : 503 };
  }
  const r = b?.result,
    uuid = (v) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  if (
    b?.version !== 1 ||
    b.requestId !== prior.request.requestId ||
    b.operation !== 'callback.admit' ||
    typeof b.replayed !== 'boolean' ||
    !r ||
    Object.keys(r).sort().join(',') !==
      'accepted,apify_run_id,durable,launch_id,replayed,run_id,scope,state' ||
    r.scope !== 'm06' ||
    r.accepted !== true ||
    r.durable !== true ||
    r.apify_run_id !== source.apify_run_id ||
    !uuid(r.run_id) ||
    !uuid(r.launch_id) ||
    !['pending', 'completed'].includes(r.state) ||
    typeof r.replayed !== 'boolean' ||
    r.replayed !== b.replayed ||
    (r.state === 'completed' && !r.replayed)
  )
    throw Error('M06_CALLBACK_ADMISSION_INVALID');
  return { ...source, accepted: true, admission: r };
}
export function m06CallbackCompletion(response, prior, maxOutputItems) {
  const b = response?.body,
    r = b?.result;
  if (
    response?.statusCode !== 200 ||
    b?.version !== 1 ||
    b.requestId !== prior?.request?.requestId ||
    b.operation !== 'callback.process' ||
    typeof b.replayed !== 'boolean' ||
    !r ||
    typeof r !== 'object' ||
    Array.isArray(r) ||
    r.state !== 'completed' ||
    typeof r.updated !== 'boolean' ||
    b.replayed !== !r.updated ||
    !Array.isArray(r.groups) ||
    r.groups.length < 1 ||
    r.groups.length > 100
  )
    throw Error('M06_CALLBACK_RECONCILIATION_REQUIRED');
  let n = 0;
  const ids = new Set();
  for (const g of r.groups) {
    if (
      !g ||
      typeof g.account_id !== 'string' ||
      ids.has(g.account_id) ||
      !['success', 'failed'].includes(g.status) ||
      !Number.isSafeInteger(g.items_new) ||
      g.items_new < 0 ||
      g.items_new > 1000 ||
      (g.status === 'failed' && g.items_new !== 0)
    )
      throw Error('M06_CALLBACK_RECONCILIATION_REQUIRED');
    ids.add(g.account_id);
    n += g.items_new;
  }
  if (
    !Number.isSafeInteger(maxOutputItems) ||
    maxOutputItems < 1 ||
    maxOutputItems > 1000 ||
    n > maxOutputItems ||
    (!r.updated && r.media_dispatch !== null)
  )
    throw Error('M06_CALLBACK_RECONCILIATION_REQUIRED');
  if (r.media_dispatch !== null) {
    const d = r.media_dispatch;
    if (
      !r.updated ||
      !d ||
      Object.keys(d).sort().join(',') !== 'items_new,queue' ||
      d.queue !== 'stories' ||
      d.items_new !== n ||
      n < 1
    )
      throw Error('M06_CALLBACK_RECONCILIATION_REQUIRED');
  }
  return { ...r, apify_run_id: prior.source.apify_run_id };
}

// RespondToWebhook1.5 passes input onward after sending the response. Admission
// is one <=8s authenticated lookup/register receipt; no actor/provider/media I/O
// precedes200. Apify's documented webhook request timeout is120s.
// https://docs.apify.com/integrations/webhooks/actions
// https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/RespondToWebhook/RespondToWebhook.node.ts
function definition(input, transport, mediaBinding, ready, limits) {
  if (
    !limits ||
    Object.keys(limits).sort().join(',') !== 'executionTimeout,maxOutputItems' ||
    !Number.isSafeInteger(limits.maxOutputItems) ||
    limits.maxOutputItems < 1 ||
    limits.maxOutputItems > 1000 ||
    !Number.isSafeInteger(limits.executionTimeout) ||
    limits.executionTimeout < 1 ||
    limits.executionTimeout > 86400 ||
    !Number.isSafeInteger(mediaBinding?.batchSize) ||
    mediaBinding.batchSize < 1 ||
    mediaBinding.batchSize > 5 ||
    Math.ceil(limits.maxOutputItems / mediaBinding.batchSize) * 300 + 8 + 60 + 120 > limits.executionTimeout
  )
    throw Error('M06_CALLBACK_RUNTIME_ENVELOPE_INVALID');
  const b = parseN8nBindings(input),
    c = ready ? parseCollectorTransport(transport) : transport,
    key = 'WF-19';
  const media = buildM06StoryMediaHandoff(b, mediaBinding, ready),
    privacy = settings(b, key);
  delete privacy.errorWorkflow;
  Object.assign(privacy, {
    executionTimeout: limits.executionTimeout,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
    availableInMCP: false,
  });
  const response = (name, status, body, position) => ({
    id: nodeId(key, name),
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    parameters: {
      respondWith: 'json',
      responseBody: body,
      options: { responseCode: status, enableStreaming: false },
    },
    position,
  });
  const admission = nativeM05Http(
    c,
    key,
    'Admit owned story callback',
    'gateway',
    c.audience + '/api/internal/n8n/collectors',
    '={{ $json.request }}',
    [600, 0],
  );
  admission.parameters.options.timeout = 8000;
  const process = nativeM05Http(
    c,
    key,
    'Process authoritative story callback',
    'gateway',
    c.audience + '/api/internal/n8n/collectors',
    '={{ $json.request }}',
    [1800, -200],
  );
  process.parameters.options.timeout = 60000;
  const nodes = [
    {
      id: nodeId(key, 'M06 story callback webhook'),
      name: 'Apify stories callback',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.2,
      parameters: {
        httpMethod: 'POST',
        path: 'emr-m06-stories-callback',
        authentication: 'none',
        responseMode: 'responseNode',
        options: {},
      },
      position: [0, -150],
      webhookId: nodeId(key, 'M06 story callback webhook'),
    },
    trigger(key, [
      ['apify_run_id', 'string'],
      ['env', 'string'],
      ['transport', 'string'],
    ]),
    code(
      key,
      'Validate story callback source',
      (ready ? '' : "throw Error('M06_CALLBACK_BINDING_REQUIRED');\n") +
        one +
        m06CallbackSource.toString() +
        '\nreturn[{json:m06CallbackSource(j)}];',
      [200, 0],
    ),
    code(
      key,
      'Prepare story callback admission',
      one +
        m06StoryRequestId.toString() +
        "\nreturn[{json:{source:j,request:{version:1,requestId:m06StoryRequestId(String($execution.id),1),operation:'callback.admit',args:{apify_run_id:j.apify_run_id}}}}];",
      [400, 0],
    ),
    admission,
    code(
      key,
      'Verify durable story admission',
      one +
        m06CallbackAdmission.toString() +
        "\nreturn[{json:m06CallbackAdmission(j,$('Prepare story callback admission').item.json)}];",
      [800, 0],
    ),
    booleanIf(key, 'Story callback admitted?', '={{ $json.accepted === true }}', [1000, 0]),
    booleanIf(key, 'Rejected story webhook?', "={{ $json.transport === 'webhook' }}", [1200, 300]),
    response(
      'Reject story callback',
      '={{ $json.statusCode }}',
      '={{ {ok:false,rejected:true,retryable:$json.statusCode===503} }}',
      [1400, 250],
    ),
    code(
      key,
      'Return rejected story callback',
      one +
        "if(j.transport==='recovery')throw Error('M06_CALLBACK_NOT_ADMITTED');return[{json:{accepted:false,rejected:true,statusCode:j.statusCode}}];",
      [1600, 400],
    ),
    booleanIf(key, 'Accepted story webhook?', "={{ $json.transport === 'webhook' }}", [1200, -200]),
    response(
      'Acknowledge durable story callback',
      200,
      '={{ {ok:true,accepted:true,state:$json.admission.state,replayed:$json.admission.replayed} }}',
      [1400, -300],
    ),
    code(
      key,
      'Prepare authoritative story processing',
      one +
        m06StoryRequestId.toString() +
        "\nif(j.accepted!==true)throw Error('M06_CALLBACK_NOT_ADMITTED');return[{json:{source:j,request:{version:1,requestId:m06StoryRequestId(String($execution.id),2),operation:'callback.process',args:{apify_run_id:j.apify_run_id}}}}];",
      [1600, -200],
    ),
    process,
    code(
      key,
      'Verify story callback completion',
      one +
        m06CallbackCompletion.toString() +
        "\nreturn[{json:m06CallbackCompletion(j,$('Prepare authoritative story processing').item.json," +
        limits.maxOutputItems +
        ')}];',
      [2000, -200],
    ),
    ...media.nodes.map((n) => ({ ...n, position: [n.position[0] + 2200, n.position[1] - 200] })),
    code(
      key,
      'Return stories callback outcome',
      one +
        "const c=$('Verify story callback completion').first().json;return[{json:{accepted:true,state:'completed',apify_run_id:c.apify_run_id,replayed:!c.updated,media:{batches:j.batches,items_new:j.itemsNew}}}];",
      [2800, 0],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    bindingManifest: {
      ready,
      environment: 'dev',
      audience: c.audience,
      credential: { ...c.credential },
      media: { ...mediaBinding },
    },
    executionEnvelope: {
      ...limits,
      mediaChildDeadlineSeconds: 300,
      admissionDeadlineSeconds: 8,
      processingDeadlineSeconds: 60,
      shutdownReserveSeconds: 120,
    },
    durability: {
      admission: 'existing_registered_job_and_idempotent_registration_request',
      acknowledgment: 'after_durable_admission_before_provider_or_media',
      recovery: 'known_job_until_settled_and_owned_story_queue_receipts',
      migration: '20261029005731_only_unchanged',
    },
    workflow: {
      name: 'WF-19-M06 · Stories callback [dev]',
      active: false,
      nodes,
      connections: {
        ...line('Apify stories callback', 'Validate story callback source'),
        ...line('When called', 'Validate story callback source'),
        ...line(
          'Validate story callback source',
          'Prepare story callback admission',
          'Admit owned story callback',
          'Verify durable story admission',
          'Story callback admitted?',
        ),
        'Story callback admitted?': {
          main: [[edge('Accepted story webhook?')], [edge('Rejected story webhook?')]],
        },
        'Rejected story webhook?': {
          main: [[edge('Reject story callback')], [edge('Return rejected story callback')]],
        },
        ...line('Reject story callback', 'Return rejected story callback'),
        'Accepted story webhook?': {
          main: [
            [edge('Acknowledge durable story callback')],
            [edge('Prepare authoritative story processing')],
          ],
        },
        ...line(
          'Acknowledge durable story callback',
          'Prepare authoritative story processing',
          'Process authoritative story callback',
          'Verify story callback completion',
          media.entry,
        ),
        ...media.connections,
        [media.exit.node]: {
          main: [[edge('Process new story media')], [edge('Return stories callback outcome')]],
        },
      },
      settings: privacy,
      tags: tags(b, ['env:dev', 'layer:ops']),
      pinData: {},
    },
    limitations: [
      'Inactive local definition until owned bindings/publication/readback. No M05 website or historical callback changes.',
      'ACK confirms durable owned work, not successful provider ingestion or media delivery. Failed processing/media requires supported known-job/queue reconciliation.',
      'Finite media batches cover the selected observation; story-lane inventory, batch size and runtime/shutdown capacity must be verified before hosted admission.',
    ],
  };
}
export function buildNativeM06Callback(
  input,
  transport,
  mediaBinding,
  limits = { maxOutputItems: 36, executionTimeout: 2700 },
) {
  return definition(input, transport, mediaBinding, true, limits);
}
export function buildUnboundNativeM06Callback(input) {
  return definition(
    input,
    {
      audience: 'https://everyone-market-researcher-unbound.vercel.app',
      credential: { id: 'UNBOUND_EMR_STORIES_AUTH', name: 'UNBOUND EMR stories dev', type: 'httpCustomAuth' },
    },
    {
      environment: 'dev',
      queue: 'stories',
      workflowId: 'UNBOUND_EMR_STORY_MEDIA',
      audience: 'https://everyone-market-researcher-unbound.vercel.app',
      batchSize: 5,
    },
    false,
    { maxOutputItems: 36, executionTimeout: 2700 },
  );
}
