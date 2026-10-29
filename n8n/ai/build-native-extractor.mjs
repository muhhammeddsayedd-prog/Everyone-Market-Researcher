import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { trigger, code, booleanIf, settings, tags, line, edge } from '../foundation/build-foundation.mjs';
import { nativeM05Http } from '../collectors/build-native-m05.mjs';

// Only transitions are serialized into Cloud Code. Request construction,
// response/schema validation and restricted SQL remain in the actual local Node
// adapter. No server-only imports, model key, image processing or external module
// loading occurs in a Cloud Code node.
export function m07Object(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function m07Uuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}
export function m07NativeId(execution, sequence, owner = false) {
  if (
    !/^[0-9]{1,15}$/.test(execution) ||
    !Number.isSafeInteger(Number(execution)) ||
    Number(execution) >= 2 ** 48 ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    sequence > 32
  )
    throw Error('M07_EXECUTION_INVALID');
  return `${owner ? 'c070aaaa' : 'c0700000'}-${sequence.toString(16).padStart(4, '0')}-4000-a000-${Number(execution).toString(16).padStart(12, '0')}`;
}
export function m07Request(state, operation, args) {
  state.sequence++;
  state.action = 'gateway';
  state.request = { version: 1, requestId: m07NativeId(state.executionId, state.sequence), operation, args };
  return state;
}
export function initializeM07Extraction(input, executionId) {
  if (!m07Object(input) || Object.keys(input).join(',') !== 'env' || input.env !== 'dev')
    throw Error('M07_INPUT_INVALID');
  const state = {
    executionId,
    sequence: 0,
    owner_id: m07NativeId(executionId, 0, true),
    attempt_id: null,
    action: 'gateway',
    result: null,
    reconciled: false,
  };
  return m07Request(state, 'claim', { owner_id: state.owner_id, limit: 1 });
}
export function m07Finish(state, status, result = null, reason = null) {
  state.action = 'done';
  state.result = { status, owner_id: state.owner_id, attempt_id: state.attempt_id, result, reason };
  delete state.provider_request;
  return state;
}
export function m07ProviderRequest(value) {
  return (
    m07Object(value) &&
    Object.keys(value).every((k) =>
      ['model', 'input', 'text', 'max_output_tokens', 'store', 'stream'].includes(k),
    ) &&
    typeof value.model === 'string' &&
    value.model.length > 0 &&
    value.store === false &&
    value.stream === false &&
    Number.isSafeInteger(value.max_output_tokens) &&
    value.max_output_tokens > 0 &&
    value.max_output_tokens <= 8192 &&
    Array.isArray(value.input) &&
    value.input.length === 2 &&
    value.input.every(
      (m) =>
        m07Object(m) &&
        ['system', 'user'].includes(m.role) &&
        Array.isArray(m.content) &&
        m.content.every((c) => m07Object(c) && c.type === 'input_text' && typeof c.text === 'string'),
    ) &&
    m07Object(value.text) &&
    m07Object(value.text.format) &&
    value.text.format.type === 'json_schema' &&
    value.text.format.strict === true &&
    m07Object(value.text.format.schema)
  );
}
export function advanceM07Gateway(original, reply) {
  const state = structuredClone(original);
  if (state.action !== 'gateway' || !m07Object(state.request)) throw Error('M07_STATE_INVALID');
  const body = m07Object(reply) && reply.statusCode === 200 && m07Object(reply.body) ? reply.body : null;
  if (
    !body ||
    body.version !== 1 ||
    body.requestId !== state.request.requestId ||
    body.operation !== state.request.operation ||
    !m07Object(body.result)
  ) {
    if (
      state.attempt_id &&
      !state.reconciled &&
      ['settle', 'outcome.unknown', 'ack'].includes(state.request.operation)
    ) {
      state.reconciled = true;
      return m07Request(state, 'status', { attempt_id: state.attempt_id, owner_id: state.owner_id });
    }
    return m07Finish(state, 'held', null, 'gateway_outcome_unknown');
  }
  const r = body.result,
    op = state.request.operation;
  if (op === 'claim') {
    if (r.owner_id !== state.owner_id || !Array.isArray(r.messages) || r.messages.length > 1)
      throw Error('M07_CLAIM_RECEIPT_INVALID');
    if (!r.messages.length) return m07Finish(state, 'empty');
    const m = r.messages[0];
    if (
      !m07Object(m) ||
      !m07Uuid(m.attempt_id) ||
      !m07Uuid(m.owner_id) ||
      !m07Uuid(m.item_id) ||
      !Number.isSafeInteger(m.read_ct) ||
      m.read_ct < 1
    )
      throw Error('M07_CLAIM_RECEIPT_INVALID');
    state.attempt_id = m.attempt_id;
    state.item_id = m.item_id;
    state.msg_id = m.msg_id;
    if (m.state === 'reconciled')
      return m07Finish(state, 'completed', m.result ?? null, 'delivery_already_reconciled');
    if (m.state === 'held') return m07Finish(state, 'held', m.result ?? null, 'existing_uncertain_attempt');
    if (m.owner_id !== state.owner_id) throw Error('M07_CLAIM_RECEIPT_INVALID');
    if (['held', 'unknown', 'dispatched'].includes(m.state))
      return m07Finish(state, 'held', m.result ?? null, 'existing_uncertain_attempt');
    if (m.state === 'failed') return m07Finish(state, 'failed', m.result ?? null, 'known_failed_attempt');
    if (m.state === 'completed')
      return m.acked
        ? m07Finish(state, 'completed', m.result)
        : m07Request(state, 'ack', { attempt_id: state.attempt_id, owner_id: state.owner_id });
    if (!['claimed', 'prepared'].includes(m.state)) throw Error('M07_CLAIM_RECEIPT_INVALID');
    return m07Request(state, 'prepare', { attempt_id: state.attempt_id, owner_id: state.owner_id });
  }
  if (r.attempt_id !== state.attempt_id) throw Error('M07_ATTEMPT_RECEIPT_INVALID');
  if (op === 'prepare') {
    if (r.owner_id !== state.owner_id || r.item_id !== state.item_id)
      throw Error('M07_ATTEMPT_RECEIPT_INVALID');
    if (r.state === 'completed')
      return r.acked
        ? m07Finish(state, 'completed', r.result)
        : m07Request(state, 'ack', { attempt_id: state.attempt_id, owner_id: state.owner_id });
    if (r.state === 'failed') return m07Finish(state, 'failed', r.result ?? null, 'known_failed_attempt');
    if (r.state !== 'prepared' || !m07ProviderRequest(r.provider_request))
      return m07Finish(state, 'held', null, 'prepare_not_ready');
    return m07Request(state, 'dispatch', { attempt_id: state.attempt_id, owner_id: state.owner_id });
  }
  if (op === 'dispatch') {
    if (r.admitted !== true || r.state !== 'dispatched')
      return m07Finish(state, 'held', null, 'dispatch_not_admitted');
    if (!m07ProviderRequest(r.provider_request)) throw Error('M07_PROVIDER_REQUEST_INVALID');
    state.action = 'provider';
    state.provider_request = r.provider_request;
    return state;
  }
  if (op === 'ack') {
    if (r.acked !== true) throw Error('M07_ACK_RECEIPT_INVALID');
    return m07Finish(state, 'completed', state.applied_result ?? null);
  }
  if (op === 'status') {
    if (r.owner_id !== state.owner_id) throw Error('M07_ATTEMPT_RECEIPT_INVALID');
    if (r.state === 'completed') {
      state.applied_result = r.result;
      return r.acked
        ? m07Finish(state, 'completed', r.result)
        : m07Request(state, 'ack', { attempt_id: state.attempt_id, owner_id: state.owner_id });
    }
    return m07Finish(
      state,
      r.state === 'failed' ? 'failed' : 'held',
      r.result ?? null,
      'reconciled_without_provider_retry',
    );
  }
  if (op === 'outcome.unknown') return m07Finish(state, 'held', r.result ?? null, 'provider_outcome_unknown');
  if (op === 'settle') {
    if (r.state === 'completed') {
      state.applied_result = r.result ?? r;
      return m07Request(state, 'ack', { attempt_id: state.attempt_id, owner_id: state.owner_id });
    }
    return m07Finish(
      state,
      r.state === 'failed' ? 'failed' : 'held',
      r.result ?? r,
      'provider_response_not_applied',
    );
  }
  throw Error('M07_STATE_INVALID');
}
export function advanceM07Provider(original, reply) {
  const state = structuredClone(original);
  if (state.action !== 'provider' || !m07Uuid(state.attempt_id)) throw Error('M07_STATE_INVALID');
  delete state.provider_request;
  if (!m07Object(reply) || reply.statusCode !== 200 || !m07Object(reply.body))
    return m07Request(state, 'outcome.unknown', { attempt_id: state.attempt_id, owner_id: state.owner_id });
  return m07Request(state, 'settle', {
    attempt_id: state.attempt_id,
    owner_id: state.owner_id,
    provider_response: reply.body,
  });
}

export const m07ExtractorCloudSource = [
  m07Object,
  m07Uuid,
  m07NativeId,
  m07Request,
  initializeM07Extraction,
  m07Finish,
  m07ProviderRequest,
  advanceM07Gateway,
  advanceM07Provider,
]
  .map((f) => f.toString())
  .join('\n\n');
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0]?.json||typeof rows[0].json!=='object'||rows[0].binary)throw Error('M07_INPUT_INVALID');const j=rows[0].json;\n";
function localTransport(value) {
  if (
    !m07Object(value) ||
    Object.keys(value).sort().join(',') !== 'audience,credential' ||
    !m07Object(value.credential) ||
    Object.keys(value.credential).sort().join(',') !== 'id,name,type' ||
    value.credential.type !== 'httpCustomAuth' ||
    !value.credential.id ||
    !value.credential.name
  )
    throw Error('M07_BINDING_REQUIRED');
  const u = new URL(value.audience);
  if (
    u.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
    !u.port ||
    u.pathname !== '/' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error('M07_LOCAL_TRANSPORT_REQUIRED');
  return structuredClone(value);
}
function definition(input, transport, ready) {
  const b = parseN8nBindings(input),
    c = localTransport(transport),
    key = 'WF-30-M07';
  if (ready) httpCredentialBinding(b, 'openai');
  const s = settings(b, 'WF-30');
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
    'Restricted extraction gateway',
    'gateway',
    c.audience + '/api/internal/m07/extract',
    '={{ $json.request }}',
    [1000, -200],
  );
  gateway.parameters.options.timeout = 30000;
  const provider = nativeM05Http(
    b,
    key,
    'OpenAI Responses text extraction',
    'openai',
    'https://api.openai.com/v1/responses',
    '={{ $json.provider_request }}',
    [1000, 200],
  );
  provider.parameters.options.timeout = 120000;
  const nodes = [
    call,
    code(
      key,
      'Initialize local extraction',
      (ready ? '' : "throw Error('M07_BINDING_REQUIRED');\n") +
        one +
        m07ExtractorCloudSource +
        '\nreturn[{json:initializeM07Extraction(j,String($execution.id))}];',
      [250, 0],
    ),
    booleanIf(key, 'Gateway request?', "={{ $json.action === 'gateway' }}", [500, 0]),
    code(key, 'Prepare extraction gateway', one + 'return[{json:j}];', [750, -200]),
    gateway,
    code(
      key,
      'Advance extraction receipt',
      one +
        m07ExtractorCloudSource +
        "\nreturn[{json:advanceM07Gateway($('Prepare extraction gateway').item.json,j)}];",
      [1250, -200],
    ),
    booleanIf(key, 'Provider admitted?', "={{ $json.action === 'provider' }}", [750, 200]),
    code(key, 'Prepare admitted model request', one + 'return[{json:j}];', [850, 200]),
    provider,
    code(
      key,
      'Advance model receipt',
      one +
        m07ExtractorCloudSource +
        "\nreturn[{json:advanceM07Provider($('Prepare admitted model request').item.json,j)}];",
      [1250, 200],
    ),
    code(
      key,
      'Return extraction outcome',
      one +
        "if(j.action!=='done'||!j.result)throw Error('M07_RECONCILIATION_REQUIRED');return[{json:j.result}];",
      [1000, 500],
    ),
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    runnableWorkflow: ready,
    liveEnabled: false,
    hostedAcceptance: false,
    definitionProfile: 'inactive_local_only',
    bindingManifest: { ready, environment: 'local', audience: c.audience },
    boundary: {
      localOnly: true,
      accounting: 'simulated_only',
      batchSize: 1,
      automaticPaidRetry: false,
      schedule: false,
      vision: false,
      mediaDispatch: false,
      embeddingExecution: false,
    },
    workflow: {
      name: 'WF-30 · AI extractor [local M07]',
      active: false,
      nodes,
      settings: s,
      tags: tags(b, ['env:dev', 'layer:ai']),
      pinData: {},
      connections: {
        ...line('When called', 'Initialize local extraction', 'Gateway request?'),
        ...edge('Gateway request?', 0, 'Prepare extraction gateway'),
        ...line(
          'Prepare extraction gateway',
          'Restricted extraction gateway',
          'Advance extraction receipt',
          'Gateway request?',
        ),
        ...edge('Gateway request?', 1, 'Provider admitted?'),
        ...edge('Provider admitted?', 0, 'Prepare admitted model request'),
        ...line(
          'Prepare admitted model request',
          'OpenAI Responses text extraction',
          'Advance model receipt',
          'Gateway request?',
        ),
        ...edge('Provider admitted?', 1, 'Return extraction outcome'),
      },
    },
  };
}
export function buildNativeExtractor(bindings, transport) {
  return definition(bindings, transport, true);
}
export function buildUnboundNativeExtractor(bindings) {
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
        name: 'M07 local gateway binding required',
        type: 'httpCustomAuth',
      },
    },
    false,
  );
}
