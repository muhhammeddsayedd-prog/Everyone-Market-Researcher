import { node, nodeId, code, booleanIf, line, edge } from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';

/** Webhook2.2 rawBody puts the ORIGINAL bytes in binary.data; do not stringify
 * parsed JSON or decode/re-encode its UTF8 content. Code's documented helper
 * reads both inline and managed binary data. HTTP4.5 binaryData sends that same
 * binary property directly as its request body.
 * https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Webhook/Webhook.node.ts#L307-L325
 * https://docs.n8n.io/build/code-in-n8n/cookbook/code-node/get-the-binary-data-buffer.md
 * https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts#L437-L459 */
export async function prepareM06ProductionGuard(rows, readBinary) {
  const reject = () => [{ json: { forward: false, statusCode: 403, response: { rejected: true } } }];
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !rows[0]?.json ||
    typeof rows[0].json !== 'object' ||
    Array.isArray(rows[0].json) ||
    !rows[0].binary?.data ||
    typeof readBinary !== 'function'
  )
    return reject();
  const headers = rows[0].json.headers;
  const signature = headers?.['x-vercel-signature'];
  if (typeof signature !== 'string' || !/^[a-f0-9]{40}$/.test(signature)) return reject();
  const length = headers?.['content-length'];
  if (
    length !== undefined &&
    (typeof length !== 'string' || !/^[0-9]{1,9}$/.test(length) || Number(length) > 32768)
  )
    return reject();
  try {
    const raw = await readBinary(0, 'data');
    if (
      !raw ||
      !Number.isSafeInteger(raw.length) ||
      raw.length < 1 ||
      raw.length > 32768 ||
      raw.byteLength !== raw.length
    )
      return reject();
    // Keep only the required signature and original binary reference. Discard
    // parsed body, cookies, query, provider headers and any input-selected URL.
    return [
      { json: { forward: true, signature }, binary: { data: rows[0].binary.data }, pairedItem: { item: 0 } },
    ];
  } catch {
    return reject();
  }
}

export function verifyM06ProductionGuardReceipt(rows) {
  const retry = () => [{ json: { statusCode: 503, response: { accepted: false, retryable: true } } }];
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.json) return retry();
  const r = rows[0].json,
    body = r.body;
  if (r.statusCode === 403) return [{ json: { statusCode: 403, response: { rejected: true } } }];
  if (
    r.statusCode !== 200 ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).sort().join(',') !== 'accepted,production_conflict' ||
    body.accepted !== true ||
    typeof body.production_conflict !== 'boolean'
  )
    return retry();
  return [
    {
      json: { statusCode: 200, response: { accepted: true, production_conflict: body.production_conflict } },
    },
  ];
}

function definition(transport, ready) {
  const c = ready ? parseCollectorTransport(transport) : transport,
    key = 'WF-M06-PRODUCTION-GUARD';
  const nodes = [
    {
      id: nodeId(key, 'Vercel production-build event'),
      name: 'Vercel production-build event',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.2,
      position: [0, 0],
      parameters: {
        httpMethod: 'POST',
        path: 'emr-m06-production-guard',
        authentication: 'none',
        responseMode: 'responseNode',
        options: { rawBody: true },
      },
      webhookId: nodeId(key, 'Owned M06 production guard webhook'),
    },
    code(
      key,
      'Bound original signed event',
      (ready ? '' : "throw Error('M06_PRODUCTION_GUARD_BINDING_REQUIRED');\n") +
        prepareM06ProductionGuard.toString() +
        '\nreturn await prepareM06ProductionGuard($input.all(),(index,field)=>this.helpers.getBinaryDataBuffer(index,field));',
      [250, 0],
    ),
    booleanIf(key, 'Forward bounded signature?', '={{ $json.forward === true }}', [500, 0]),
    {
      ...node(
        key,
        'Forward original signed bytes',
        'httpRequest',
        {
          method: 'POST',
          url: c.audience + '/api/internal/m06/production-conflict',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpCustomAuth',
          sendQuery: false,
          sendHeaders: true,
          specifyHeaders: 'keypair',
          headerParameters: {
            parameters: [
              { name: 'x-vercel-signature', value: '={{ $json.signature }}' },
              { name: 'content-type', value: 'application/json' },
            ],
          },
          sendBody: true,
          contentType: 'binaryData',
          inputDataFieldName: 'data',
          options: {
            timeout: 10000,
            allowUnauthorizedCerts: false,
            redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
            sendCredentialsOnCrossOriginRedirect: false,
            response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
          },
        },
        [750, -100],
      ),
      credentials: { httpCustomAuth: { id: c.credential.id, name: c.credential.name } },
      retryOnFail: false,
      onError: 'stopWorkflow',
    },
    code(
      key,
      'Verify durable conflict result',
      verifyM06ProductionGuardReceipt.toString() + '\nreturn verifyM06ProductionGuardReceipt($input.all());',
      [1000, -100],
    ),
    {
      id: nodeId(key, 'Acknowledge verified guard result'),
      name: 'Acknowledge verified guard result',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [1250, 0],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json.response }}',
        options: { responseCode: '={{ $json.statusCode }}', enableStreaming: false },
      },
    },
  ];
  return {
    key,
    kind: 'native-json-blueprint',
    runnableWorkflow: true,
    liveEnabled: false,
    hostedAcceptance: false,
    definitionProfile: 'inactive_native_staging',
    bindingManifest: { ready, environment: 'dev', audience: c.audience, credential: { ...c.credential } },
    security: {
      originalBytes: 'webhook_rawBody_binary_data_to_HTTP_binaryData',
      signatureVerification: 'pinned_preview_HMAC_and_durable_campaign_pause',
      maxBytes: 32768,
      providerSecretInN8n: false,
      managementCredentialsInRuntime: false,
      queryTokenUrl: false,
      retention:
        'execution_progress_success_error_manual_off; transient_native_binary_processing_remains_platform_managed',
    },
    workflow: {
      name: 'M06 · Production-build conflict guard [dev]',
      active: false,
      nodes,
      pinData: {},
      tags: [],
      settings: {
        executionOrder: 'v1',
        timezone: 'Africa/Cairo',
        executionTimeout: 30,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        saveDataSuccessExecution: 'none',
        saveDataErrorExecution: 'none',
        saveManualExecutions: false,
        saveExecutionProgress: false,
      },
      connections: {
        ...line('Vercel production-build event', 'Bound original signed event', 'Forward bounded signature?'),
        'Forward bounded signature?': {
          main: [[edge('Forward original signed bytes')], [edge('Acknowledge verified guard result')]],
        },
        ...line(
          'Forward original signed bytes',
          'Verify durable conflict result',
          'Acknowledge verified guard result',
        ),
      },
    },
  };
}

export function buildNativeM06ProductionGuard(transport) {
  return definition(transport, true);
}
export function buildUnboundM06ProductionGuard() {
  return definition(
    {
      audience: 'https://everyone-market-researcher-unbound.vercel.app',
      credential: {
        id: 'UNBOUND_EMR_CAMPAIGN_AUTH',
        name: 'UNBOUND EMR campaign dev',
        type: 'httpCustomAuth',
      },
    },
    false,
  );
}
