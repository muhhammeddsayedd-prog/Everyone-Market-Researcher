import { readFileSync } from 'node:fs';
import { node, code, edge, trigger } from '../foundation/build-foundation.mjs';

// HTTP Request4.5 parameters and privacy settings are pinned to official n8n2.43.5:
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/Description.ts
// https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/workflow/src/interfaces.ts
// Server-only imports stay in the authenticated Vercel Node route, never Code nodes.
const catalog = JSON.parse(readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'));
const path = '/api/internal/media/process';
const unbound = {
  audience: 'https://everyone-market-researcher-unbound.vercel.app',
  credential: {
    id: 'UNBOUND_EMR_MEDIA_AUTH',
    name: 'UNBOUND EMR media dev',
    type: 'httpCustomAuth',
    environment: 'dev',
  },
};
export function parseMediaTransport(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(',') !== 'audience,credential' ||
    typeof input.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(input.audience) ||
    /(?:unbound|placeholder)/i.test(input.audience) ||
    !input.credential ||
    typeof input.credential !== 'object' ||
    Array.isArray(input.credential) ||
    Object.keys(input.credential).sort().join(',') !== 'environment,id,name,type' ||
    typeof input.credential.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.credential.id) ||
    /(?:unbound|placeholder)/i.test(input.credential.id) ||
    typeof input.credential.name !== 'string' ||
    input.credential.name.length < 1 ||
    input.credential.name.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(input.credential.name) ||
    input.credential.type !== 'httpCustomAuth' ||
    input.credential.environment !== 'dev'
  )
    throw Error('M06_MEDIA_BINDING_INVALID');
  return structuredClone(input);
}

function mediaPreflight(binding, rows, executionId) {
  if (
    !binding.ready ||
    binding.environment !== 'dev' ||
    binding.type !== 'httpCustomAuth' ||
    typeof binding.credentialId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(binding.credentialId) ||
    /(?:unbound|placeholder)/i.test(binding.credentialId) ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(binding.audience ?? '') ||
    /(?:unbound|placeholder)/i.test(binding.audience)
  )
    throw Error('M06_MEDIA_BINDING_REQUIRED');
  if (typeof executionId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(executionId))
    throw Error('M06_MEDIA_EXECUTION_INVALID');
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !rows[0]?.json ||
    typeof rows[0].json !== 'object' ||
    Array.isArray(rows[0].json) ||
    Object.keys(rows[0].json).length !== 0 ||
    rows[0].binary
  )
    throw Error('M06_MEDIA_INPUT_INVALID');
  return [
    {
      json: {
        execution_id: executionId,
        url: binding.audience + '/api/internal/media/process',
        body: { execution_id: executionId },
      },
    },
  ];
}
function mediaReceipt(rows, prepared) {
  const invalid = () => {
    throw Error('M06_MEDIA_RECEIPT_INVALID');
  };
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !rows[0]?.json ||
    !prepared ||
    typeof prepared.execution_id !== 'string'
  )
    invalid();
  const response = rows[0].json,
    b = response.body;
  if (response.statusCode === 409) throw Error('M06_MEDIA_RECONCILIATION_REQUIRED');
  if (response.statusCode !== 200 || !b || typeof b !== 'object' || Array.isArray(b)) invalid();
  const keys = [
    'version',
    'execution_id',
    'replayed',
    'state',
    'claimed',
    'processed',
    'held',
    'stored',
    'skipped',
    'expired',
    'retryable',
    'reconciliation_required',
    'bytes',
    'infrastructure_cost_usd',
  ];
  if (
    Object.keys(b).length !== keys.length ||
    Object.keys(b).some((k) => !keys.includes(k)) ||
    b.version !== 1 ||
    b.execution_id !== prepared.execution_id ||
    typeof b.replayed !== 'boolean' ||
    !['completed', 'partial', 'reconciliation_required'].includes(b.state) ||
    b.infrastructure_cost_usd !== null
  )
    invalid();
  for (const key of [
    'claimed',
    'processed',
    'held',
    'stored',
    'skipped',
    'expired',
    'retryable',
    'reconciliation_required',
  ])
    if (!Number.isSafeInteger(b[key]) || b[key] < 0 || b[key] > 50) invalid();
  if (
    !Number.isSafeInteger(b.bytes) ||
    b.bytes < 0 ||
    b.bytes > 104857600 ||
    b.held > b.claimed ||
    b.processed > b.claimed - b.held ||
    b.stored + b.skipped + b.expired + b.retryable + b.reconciliation_required !== b.processed ||
    (b.state === 'completed' && (b.held > 0 || b.retryable > 0 || b.reconciliation_required > 0))
  )
    invalid();
  if (b.state === 'reconciliation_required') throw Error('M06_MEDIA_RECONCILIATION_REQUIRED');
  // Only the fixed redacted server receipt is returned. No headers/URLs/binary.
  return [{ json: Object.fromEntries(keys.map((key) => [key, b[key]])) }];
}

function definition(transport, ready) {
  const key = 'WF-31',
    binding = {
      ready,
      environment: 'dev',
      type: transport.credential.type,
      credentialId: transport.credential.id,
      audience: transport.audience,
    };
  const nodes = [
    node(key, 'Manual dev check', 'manualTrigger', {}, [-240, -100]),
    {
      ...trigger(key, []),
      // ExecuteWorkflowTrigger1.3 rejects an explicitly empty declared schema
      // at publication (minRequiredFields:1). Accept data at the native entry;
      // mediaPreflight still permits exactly one empty JSON object before I/O.
      // https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.ts
      parameters: { inputSource: 'passthrough' },
      position: [-240, 100],
    },
    code(
      key,
      'Validate media binding',
      mediaPreflight.toString() +
        '\nreturn mediaPreflight(' +
        JSON.stringify(binding) +
        ',$input.all(),$execution.id);',
      [0, 0],
    ),
    {
      ...node(
        key,
        'Process media batch',
        'httpRequest',
        {
          method: 'POST',
          url: '={{ $json.url }}',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpCustomAuth',
          sendQuery: false,
          sendHeaders: false,
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ $json.body }}',
          options: {
            timeout: 270000,
            allowUnauthorizedCerts: false,
            redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
            sendCredentialsOnCrossOriginRedirect: false,
            response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
          },
        },
        [260, 0],
      ),
      credentials: { httpCustomAuth: { id: transport.credential.id, name: transport.credential.name } },
      retryOnFail: false,
      onError: 'stopWorkflow',
    },
    code(
      key,
      'Verify media receipt',
      mediaReceipt.toString() +
        "\nreturn mediaReceipt($input.all(),$('Validate media binding').first().json);",
      [520, 0],
    ),
  ];
  return {
    key,
    kind: 'generated_inactive_native_definition',
    nativeSaved: false,
    hostedAcceptance: false,
    liveEnabled: false,
    bindingManifest: {
      ready,
      environment: 'dev',
      endpointPath: path,
      audience: transport.audience,
      credential: { ...transport.credential },
      requiredHeaders: ['x-emr-secret', 'x-vercel-protection-bypass'],
      imageRuntime: 'vercel-node-sharp',
      sourceDataInCloud: false,
      note: ready
        ? 'Reference shape validated locally; native credential availability and private header values require explicit preflight.'
        : 'No media credential or exact dev Preview binding is recorded in the catalog; placeholder blocks before HTTP.',
    },
    workflow: {
      name: 'WF-31 · Media [dev]',
      active: false,
      nodes,
      connections: {
        'Manual dev check': { main: [[edge('Validate media binding')]] },
        'When called': { main: [[edge('Validate media binding')]] },
        'Validate media binding': { main: [[edge('Process media batch')]] },
        'Process media batch': { main: [[edge('Verify media receipt')]] },
      },
      settings: {
        executionOrder: 'v1',
        timezone: 'Africa/Cairo',
        executionTimeout: 300,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        saveDataSuccessExecution: 'none',
        saveDataErrorExecution: 'none',
        saveManualExecutions: false,
        saveExecutionProgress: false,
      },
      tags: [catalog.tagRefs['env:dev'], catalog.tagRefs['layer:ops']],
      pinData: {},
    },
  };
}
export function buildNativeMedia(transport) {
  return definition(parseMediaTransport(transport), true);
}
export function buildUnboundNativeMedia() {
  return definition(unbound, false);
}
