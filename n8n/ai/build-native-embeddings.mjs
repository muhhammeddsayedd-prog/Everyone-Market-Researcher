import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { trigger, code, booleanIf, settings, tags, line, edge } from '../foundation/build-foundation.mjs';
import { nativeM05Http } from '../collectors/build-native-m05.mjs';

// Only these dependency-free transitions are serialized into Cloud Code.
// Context, hashing, vector validation, costing and SQL remain in the gateway.
export function m07EmbeddingObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function m07EmbeddingUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}
export function m07EmbeddingId(execution, sequence, owner = false) {
  if (
    !/^[0-9]{1,15}$/.test(execution) ||
    !Number.isSafeInteger(Number(execution)) ||
    Number(execution) >= 2 ** 48 ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    sequence > 32
  )
    throw Error('M07_EMBED_EXECUTION_INVALID');
  return `${owner ? 'c073aaaa' : 'c0730000'}-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(execution).toString(16).padStart(12, '0')}`;
}
export function m07EmbeddingRequest(s, operation, args) {
  s.sequence++;
  s.action = 'gateway';
  s.request = { version: 1, requestId: m07EmbeddingId(s.executionId, s.sequence), operation, args };
  return s;
}
export function initializeM07Embeddings(input, executionId) {
  if (!m07EmbeddingObject(input) || Object.keys(input).join(',') !== 'env' || input.env !== 'dev')
    throw Error('M07_EMBED_INPUT_INVALID');
  const s = {
    executionId,
    sequence: 0,
    owner_id: m07EmbeddingId(executionId, 0, true),
    batch_id: null,
    action: 'gateway',
    result: null,
    reconciled: false,
  };
  return m07EmbeddingRequest(s, 'claim', { owner_id: s.owner_id });
}
export function m07EmbeddingFinish(s, status, result = null, reason = null) {
  s.action = 'done';
  s.result = { status, owner_id: s.owner_id, batch_id: s.batch_id, result, reason };
  delete s.provider_request;
  return s;
}
export function m07EmbeddingProviderRequest(r) {
  if (
    !m07EmbeddingObject(r) ||
    Object.keys(r).sort().join(',') !== 'dimensions,encoding_format,input,model' ||
    typeof r.model !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(r.model) ||
    r.dimensions !== 1536 ||
    r.encoding_format !== 'float' ||
    !Array.isArray(r.input) ||
    r.input.length < 1 ||
    r.input.length > 20
  )
    return false;
  let total = 0;
  for (const text of r.input) {
    if (typeof text !== 'string' || !text.trim()) return false;
    let size;
    try {
      size = (encodeURIComponent(text).match(/%[0-9A-F]{2}|[^%]/g) || []).length;
    } catch {
      return false;
    }
    if (size > 8192) return false;
    total += size;
  }
  return total <= 300000;
}
export function advanceM07EmbeddingGateway(original, reply) {
  const s = structuredClone(original);
  if (s.action !== 'gateway' || !m07EmbeddingObject(s.request)) throw Error('M07_EMBED_STATE_INVALID');
  const body =
    m07EmbeddingObject(reply) && reply.statusCode === 200 && m07EmbeddingObject(reply.body)
      ? reply.body
      : null;
  if (
    !body ||
    body.version !== 1 ||
    body.requestId !== s.request.requestId ||
    body.operation !== s.request.operation ||
    !m07EmbeddingObject(body.result)
  ) {
    if (s.batch_id && !s.reconciled && ['settle', 'outcome.unknown', 'ack'].includes(s.request.operation)) {
      s.reconciled = true;
      return m07EmbeddingRequest(s, 'status', { batch_id: s.batch_id, owner_id: s.owner_id });
    }
    return m07EmbeddingFinish(s, 'held', null, 'gateway_outcome_unknown');
  }
  const r = body.result,
    op = s.request.operation;
  if (op === 'claim') {
    if (r.state === 'empty' && r.batch_id === null && Array.isArray(r.messages) && !r.messages.length)
      return m07EmbeddingFinish(s, 'empty');
    if (!m07EmbeddingUuid(r.batch_id) || !m07EmbeddingUuid(r.owner_id))
      throw Error('M07_EMBED_CLAIM_INVALID');
    s.batch_id = r.batch_id;
    if (r.state === 'held') return m07EmbeddingFinish(s, 'held', r.result ?? null, 'existing_batch_held');
    if (r.owner_id !== s.owner_id || !Array.isArray(r.messages) || r.messages.length > 20)
      throw Error('M07_EMBED_CLAIM_INVALID');
    if (r.state === 'completed')
      return r.acked
        ? m07EmbeddingFinish(s, 'completed', r.result)
        : m07EmbeddingRequest(s, 'ack', { batch_id: s.batch_id, owner_id: s.owner_id });
    if (r.state === 'failed') return m07EmbeddingFinish(s, 'failed', r.result ?? null, 'known_failed_batch');
    if (['dispatched', 'unknown'].includes(r.state))
      return m07EmbeddingFinish(s, 'held', r.result ?? null, 'existing_batch_held');
    if (!['claimed', 'prepared'].includes(r.state)) throw Error('M07_EMBED_CLAIM_INVALID');
    return m07EmbeddingRequest(s, 'prepare', { batch_id: s.batch_id, owner_id: s.owner_id });
  }
  if (r.batch_id !== s.batch_id || r.owner_id !== s.owner_id) throw Error('M07_EMBED_BATCH_INVALID');
  if (s.request_hash && r.request_hash !== s.request_hash) throw Error('M07_EMBED_SNAPSHOT_MISMATCH');
  if (op === 'prepare') {
    if (r.state === 'completed') {
      s.applied_result = r.result;
      return r.acked
        ? m07EmbeddingFinish(s, 'completed', r.result)
        : m07EmbeddingRequest(s, 'ack', { batch_id: s.batch_id, owner_id: s.owner_id });
    }
    if (r.state === 'failed') return m07EmbeddingFinish(s, 'failed', r.result ?? null, 'known_failed_batch');
    if (r.state !== 'prepared') return m07EmbeddingFinish(s, 'held', r.result ?? null, 'prepare_not_ready');
    if (
      typeof r.request_hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(r.request_hash) ||
      !m07EmbeddingObject(r.snapshot) ||
      !m07EmbeddingProviderRequest(r.snapshot.provider_request)
    )
      throw Error('M07_EMBED_PREPARE_INVALID');
    s.request_hash = r.request_hash;
    return m07EmbeddingRequest(s, 'dispatch', { batch_id: s.batch_id, owner_id: s.owner_id });
  }
  if (op === 'dispatch') {
    if (r.admitted !== true || r.state !== 'dispatched')
      return m07EmbeddingFinish(s, 'held', r.result ?? null, 'dispatch_not_admitted');
    if (!m07EmbeddingObject(r.snapshot) || !m07EmbeddingProviderRequest(r.snapshot.provider_request))
      throw Error('M07_EMBED_REQUEST_INVALID');
    s.action = 'provider';
    s.provider_request = r.snapshot.provider_request;
    return s;
  }
  if (op === 'ack') {
    if (r.acked !== true) throw Error('M07_EMBED_ACK_INVALID');
    return m07EmbeddingFinish(s, 'completed', s.applied_result ?? r.result ?? null);
  }
  if (op === 'status') {
    if (r.state === 'completed') {
      s.applied_result = r.result;
      return r.acked
        ? m07EmbeddingFinish(s, 'completed', r.result)
        : m07EmbeddingRequest(s, 'ack', { batch_id: s.batch_id, owner_id: s.owner_id });
    }
    return m07EmbeddingFinish(
      s,
      r.state === 'failed' ? 'failed' : 'held',
      r.result ?? null,
      'reconciled_without_provider_retry',
    );
  }
  if (op === 'outcome.unknown')
    return m07EmbeddingFinish(
      s,
      r.state === 'failed' ? 'failed' : 'held',
      r.result ?? null,
      r.state === 'failed' ? 'known_failed_batch' : 'provider_outcome_unknown',
    );
  if (op === 'settle') {
    if (r.state === 'completed') {
      s.applied_result = r.result;
      return m07EmbeddingRequest(s, 'ack', { batch_id: s.batch_id, owner_id: s.owner_id });
    }
    return m07EmbeddingFinish(
      s,
      r.state === 'failed' ? 'failed' : 'held',
      r.result ?? null,
      'provider_response_not_applied',
    );
  }
  throw Error('M07_EMBED_STATE_INVALID');
}
export function advanceM07EmbeddingProvider(original, reply) {
  const s = structuredClone(original);
  if (s.action !== 'provider' || !m07EmbeddingUuid(s.batch_id)) throw Error('M07_EMBED_STATE_INVALID');
  delete s.provider_request;
  if (!m07EmbeddingObject(reply) || reply.statusCode !== 200 || !m07EmbeddingObject(reply.body))
    return m07EmbeddingRequest(s, 'outcome.unknown', { batch_id: s.batch_id, owner_id: s.owner_id });
  return m07EmbeddingRequest(s, 'settle', {
    batch_id: s.batch_id,
    owner_id: s.owner_id,
    provider_response: reply.body,
  });
}
export const m07EmbeddingsCloudSource = [
  m07EmbeddingObject,
  m07EmbeddingUuid,
  m07EmbeddingId,
  m07EmbeddingRequest,
  initializeM07Embeddings,
  m07EmbeddingFinish,
  m07EmbeddingProviderRequest,
  advanceM07EmbeddingGateway,
  advanceM07EmbeddingProvider,
]
  .map((f) => f.toString())
  .join('\n\n');

const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0]?.json||typeof rows[0].json!=='object'||rows[0].binary)throw Error('M07_EMBED_INPUT_INVALID');const j=rows[0].json;\n";
function transportConfig(value) {
  if (
    !m07EmbeddingObject(value) ||
    !m07EmbeddingObject(value.credential) ||
    Object.keys(value.credential).sort().join(',') !== 'id,name,type' ||
    value.credential.type !== 'httpCustomAuth' ||
    typeof value.credential.id !== 'string' ||
    !value.credential.id ||
    typeof value.credential.name !== 'string' ||
    !value.credential.name
  )
    throw Error('M07_EMBED_BINDING_REQUIRED');
  let u;
  try {
    u = new URL(value.audience);
  } catch {
    throw Error('M07_EMBED_TRANSPORT_INVALID');
  }
  if (u.pathname !== '/' || u.username || u.password || u.search || u.hash)
    throw Error('M07_EMBED_TRANSPORT_INVALID');
  if (value.profile === undefined) {
    if (
      Object.keys(value).sort().join(',') !== 'audience,credential' ||
      u.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      !u.port
    )
      throw Error('M07_EMBED_TRANSPORT_INVALID');
  } else if (
    value.profile !== 'dev' ||
    Object.keys(value).sort().join(',') !==
      'audience,branch,commitSha,credential,deploymentId,profile,projectId,projectRef' ||
    u.protocol !== 'https:' ||
    u.port ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(u.hostname) ||
    value.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    value.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    value.branch !== 'm07-ai-understanding' ||
    !/^[a-f0-9]{40}$/.test(value.commitSha ?? '') ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(value.deploymentId ?? '')
  )
    throw Error('M07_EMBED_DEV_BINDING_INVALID');
  return structuredClone(value);
}
function definition(input, transport, ready) {
  const b = parseN8nBindings(input),
    c = transportConfig(transport),
    key = 'WF-33-M07';
  if (ready) httpCredentialBinding(b, 'openai');
  const s = settings(b, 'WF-33');
  delete s.errorWorkflow;
  Object.assign(s, {
    executionTimeout: 900,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
    availableInMCP: false,
  });
  const call = trigger(key, []);
  call.parameters = { inputSource: 'passthrough' };
  const gateway = nativeM05Http(
    c,
    key,
    'Restricted embedding gateway',
    'gateway',
    c.audience + '/api/internal/m07/embed',
    '={{ $json.request }}',
    [1000, -200],
  );
  gateway.parameters.options.timeout = 30000;
  const provider = nativeM05Http(
    b,
    key,
    'OpenAI embeddings',
    'openai',
    'https://api.openai.com/v1/embeddings',
    '={{ $json.provider_request }}',
    [1000, 200],
  );
  provider.parameters.options.timeout = 120000;
  const nodes = [
    call,
    code(
      key,
      'Initialize embeddings',
      (ready ? '' : "throw Error('M07_EMBED_BINDING_REQUIRED');\n") +
        one +
        m07EmbeddingsCloudSource +
        '\nreturn[{json:initializeM07Embeddings(j,String($execution.id))}];',
      [250, 0],
    ),
    booleanIf(key, 'Embedding gateway request?', "={{ $json.action === 'gateway' }}", [500, 0]),
    code(key, 'Prepare embedding gateway', one + 'return[{json:j}];', [750, -200]),
    gateway,
    code(
      key,
      'Advance embedding receipt',
      one +
        m07EmbeddingsCloudSource +
        "\nreturn[{json:advanceM07EmbeddingGateway($('Prepare embedding gateway').item.json,j)}];",
      [1250, -200],
    ),
    booleanIf(key, 'Embedding provider admitted?', "={{ $json.action === 'provider' }}", [750, 200]),
    code(key, 'Prepare admitted embedding request', one + 'return[{json:j}];', [850, 200]),
    provider,
    code(
      key,
      'Advance embedding model receipt',
      one +
        m07EmbeddingsCloudSource +
        "\nreturn[{json:advanceM07EmbeddingProvider($('Prepare admitted embedding request').item.json,j)}];",
      [1250, 200],
    ),
    code(
      key,
      'Return embedding outcome',
      one +
        "if(j.action!=='done'||!j.result)throw Error('M07_EMBED_RECONCILIATION_REQUIRED');return[{json:j.result}];",
      [1000, 500],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    runnableWorkflow: ready,
    liveEnabled: false,
    hostedAcceptance: false,
    definitionProfile: c.profile === 'dev' ? 'inactive_disabled_dev' : 'inactive_local_only',
    bindingManifest: {
      ready,
      profile: c.profile ?? 'local',
      audience: c.audience,
      ...(c.profile === 'dev'
        ? {
            projectRef: c.projectRef,
            projectId: c.projectId,
            branch: c.branch,
            commitSha: c.commitSha,
            deploymentId: c.deploymentId,
          }
        : {}),
    },
    boundary: {
      developmentOnly: true,
      defaultDisabled: true,
      batchSizeServerSelected: true,
      maxBatchInputs: 20,
      dimensions: 1536,
      aggregateUsageOnly: true,
      automaticPaidRetry: false,
      schedule: false,
    },
    workflow: {
      name: 'WF-33 - Embeddings [M07 dev]',
      active: false,
      nodes,
      settings: s,
      tags: tags(b, ['env:dev', 'layer:ai']),
      pinData: {},
      connections: {
        ...line('When called', 'Initialize embeddings', 'Embedding gateway request?'),
        ...edge('Embedding gateway request?', 0, 'Prepare embedding gateway'),
        ...line(
          'Prepare embedding gateway',
          'Restricted embedding gateway',
          'Advance embedding receipt',
          'Embedding gateway request?',
        ),
        ...edge('Embedding gateway request?', 1, 'Embedding provider admitted?'),
        ...edge('Embedding provider admitted?', 0, 'Prepare admitted embedding request'),
        ...line(
          'Prepare admitted embedding request',
          'OpenAI embeddings',
          'Advance embedding model receipt',
          'Embedding gateway request?',
        ),
        ...edge('Embedding provider admitted?', 1, 'Return embedding outcome'),
      },
    },
  };
}
export function buildNativeEmbeddings(bindings, transport) {
  return definition(bindings, transport, true);
}
export function buildUnboundNativeEmbeddings(bindings) {
  const b = structuredClone(bindings);
  b.credentials.openai = {
    id: 'M07_OPENAI_BINDING_REQUIRED',
    name: 'OpenAI binding required',
    type: 'openAiApi',
    environment: 'dev',
  };
  return definition(
    b,
    {
      audience: 'http://127.0.0.1:3037',
      credential: {
        id: 'M07_GATEWAY_BINDING_REQUIRED',
        name: 'M07 gateway binding required',
        type: 'httpCustomAuth',
      },
    },
    false,
  );
}
