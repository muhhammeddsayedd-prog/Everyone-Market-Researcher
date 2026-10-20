import { isDeepStrictEqual } from 'node:util';
import { node, edge, nodeId } from '../../n8n/foundation/build-foundation.mjs';

// Fixed approved Phase B negative control. It cannot start an actor, accept a
// caller URL, create a workflow, or change credential data. This pure reducer
// receives private native data only inside the bounded native reader; its plain
// projection is not a native-receipt brand or execution/settlement proof.
export const foundationNativeDomainProbe = Object.freeze({
  caseId: 'control.machine_domain',
  key: 'WF-99',
  targetAudience: 'https://everyone-market-researcher-8f7sa5lox-muhammed-abdelrahman.vercel.app',
  credentialId: 'EmrM03Machine19',
  credentialName: 'M03 foundation machine [dev]',
  nativeExecutionsMaximum: 1,
});
const S = foundationNativeDomainProbe;
const fail = () => {
  throw Error('FOUNDATION_NATIVE_DOMAIN_PROBE_BLOCKED');
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && isDeepStrictEqual(Object.keys(v).sort(), [...keys].sort());
function runtimeHost(audience) {
  if (
    typeof audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience) ||
    audience === S.targetAudience
  )
    fail();
  return new URL(audience).host;
}
export function buildFoundationNativeDomainProbe(input) {
  if (!exact(input, ['runtimeAudience', 'settings'])) fail();
  runtimeHost(input.runtimeAudience);
  const settings = input.settings;
  if (
    !object(settings) ||
    settings.saveManualExecutions !== true ||
    settings.saveExecutionProgress !== false ||
    settings.saveDataSuccessExecution !== 'none' ||
    settings.saveDataErrorExecution !== 'none' ||
    settings.availableInMCP !== true
  )
    fail();
  const manual = node(S.key, 'Manual Machine domain control', 'manualTrigger', {}, [0, 0]);
  const http = {
    ...node(
      S.key,
      'Machine old-audience domain denial',
      'httpRequest',
      {
        method: 'POST',
        url: S.targetAudience + '/api/internal/n8n/foundation',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpCustomAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: JSON.stringify({
          version: 1,
          requestId: nodeId(S.key, S.caseId),
          operation: 'identity.read',
          args: {},
        }),
        sendHeaders: false,
        sendQuery: false,
        options: {
          timeout: 15000,
          allowUnauthorizedCerts: false,
          redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
          sendCredentialsOnCrossOriginRedirect: false,
          response: { response: { responseFormat: 'json', fullResponse: true, neverError: false } },
        },
      },
      [240, 0],
    ),
    credentials: { httpCustomAuth: { id: S.credentialId, name: S.credentialName } },
    retryOnFail: false,
    onError: 'stopWorkflow',
  };
  const connections = { [manual.name]: { main: [[edge(http.name)]] } };
  const probeSettings = structuredClone(settings);
  // No automatic error routing belongs to this one-execution negative control.
  // Runtime save clears a native inherited link with the reviewed DEFAULT form.
  delete probeSettings.errorWorkflow;
  return {
    key: S.key,
    workflow: {
      name: 'WF-99 · Foundation smoke test [dev]',
      nodes: [manual, http],
      connections,
      settings: probeSettings,
    },
  };
}
export function isFoundationNativeDomainProbeBody(body, { runtimeAudience }) {
  try {
    return isDeepStrictEqual(
      body,
      buildFoundationNativeDomainProbe({ runtimeAudience, settings: body?.settings }).workflow,
    );
  } catch {
    return false;
  }
}
function nativeError(error, message, http) {
  // Pinned2.43.5 executeLegacyRequest checks domains before invokeAxios.
  // assertUrlAllowed(without node) throws UserError; HTTP4.5 wraps that promise
  // rejection in NodeApiError. workflow-execute.reportNodeExecutionError spreads
  // its enumerable fields into a plain object, dropping nonenumerable cause.
  // A remote HTTP403 has a non-null httpCode and cannot satisfy this projection.
  return (
    object(error) &&
    error.name === 'NodeApiError' &&
    error.message === message &&
    error.httpCode === null &&
    isDeepStrictEqual(error.node, http) &&
    object(error.context) &&
    object(error.context.request) &&
    error.context.request.method === 'POST' &&
    error.context.request.uri === http.parameters.url &&
    ['statusCode', 'status', 'response', 'errorResponse'].every(
      (k) => error[k] === undefined || error[k] === null,
    )
  );
}
export function projectFoundationNativeDomainDenial({ resultData, body, runtimeAudience }) {
  const allowedHost = runtimeHost(runtimeAudience);
  if (
    !isFoundationNativeDomainProbeBody(body, { runtimeAudience }) ||
    !object(resultData) ||
    !object(resultData.runData)
  )
    fail();
  const [manual, http] = body.nodes;
  if (!exact(resultData.runData, [manual.name, http.name])) fail();
  const manualRuns = resultData.runData[manual.name],
    runs = resultData.runData[http.name];
  const manualItems = manualRuns?.[0]?.data?.main?.[0];
  const emptyManualItem = (item) =>
    object(item) &&
    exact(item.json, []) &&
    (exact(item, ['json']) ||
      (exact(item, ['json', 'pairedItem']) && isDeepStrictEqual(item.pairedItem, { item: 0 })));
  if (
    !Array.isArray(manualRuns) ||
    manualRuns.length !== 1 ||
    manualRuns[0].error !== undefined ||
    !exact(manualRuns[0].data, ['main']) ||
    !Array.isArray(manualRuns[0].data.main) ||
    manualRuns[0].data.main.length !== 1 ||
    !Array.isArray(manualItems) ||
    manualItems.length !== 1 ||
    !emptyManualItem(manualItems[0]) ||
    !Array.isArray(runs) ||
    runs.length !== 1 ||
    runs[0].data !== undefined
  )
    fail();
  const message = `Domain not allowed: This credential is restricted from accessing ${new URL(S.targetAudience).host}. Only the following domains are allowed: ${allowedHost}`;
  if (!nativeError(resultData.error, message, http) || !nativeError(runs[0].error, message, http)) fail();
  return Object.freeze({
    kind: 'foundation_native_domain_denial_projection',
    restrictionCode: 'native_credential_domain_blocked',
    credentialId: S.credentialId,
    targetAudience: S.targetAudience,
    allowedHost,
    httpRequestIssued: false,
    actorStarts: 0,
  });
}
