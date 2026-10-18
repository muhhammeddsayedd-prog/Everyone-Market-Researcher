import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import { node, code, postgres, line, inputPrelude } from './build-foundation.mjs';

// Temporary, owned manual probes are an explicit exception to foundation error
// routing. They never call WF90, activate a workflow, collect content or infer.
// HTTP4.5 contracts: pinned n8n@2.43.5 HttpRequest/V3/{Description,HttpRequestV3.node}.ts.
// Native Apify0.6.10: apify/n8n-nodes-apify@8edec8b87b811c0e85286b6f56e0124c021e26b5.
export const credentialProbeEndpoints = Object.freeze({
  // /users/me includes proxy.password. The limits-only endpoint avoids it.
  apify: 'https://api.apify.com/v2/users/me/limits',
  openai: 'https://api.openai.com/v1/models',
  vimeo: 'https://api.vimeo.com/users/everyonefilms?fields=uri',
  youtube:
    'https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=%40AflamProductions&fields=kind,items(id)',
});
const identitySql =
  "select current_user as current_user, session_user as session_user, current_database() as database, current_setting('server_version_num')::integer as server_version_num;";
const safeErrorCode = `const rows=$input.all();
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const j=rows.length===1&&object(rows[0].json)?rows[0].json:{};
const error=typeof j.message==='string'?j.message:typeof j.error==='string'?j.error:typeof j.error?.message==='string'?j.error.message:'';
const detail=error.slice(0,4096);
const failure=/certificate|self.signed|\\bSSL\\b|\\bTLS\\b/i.test(detail)?'tls_failed':
  /password authentication|authentication failed|invalid authentication/i.test(detail)?'authentication_failed':
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|timeout/i.test(detail)?'network_failed':'native_failed';
`;
const postgresProjection =
  safeErrorCode +
  `const identity=rows.length===1&&j.current_user==='n8n_writer'&&j.session_user==='n8n_writer'&&
  j.database==='postgres'&&Number.isInteger(j.server_version_num)&&Math.floor(j.server_version_num/10000)===17;
return [{json:{service:'postgres',status:identity?'verified':error?failure:'identity_rejected',
  authenticationVerified:identity,identityVerified:identity,readOnly:true,projectTargetVerified:false}}];`;

function providerProjection(service) {
  return (
    safeErrorCode +
    `const body=j.body;
const number=n=>Number.isFinite(n)&&n>=0;
let valid=false;
if(j.statusCode===200&&object(body)) {
  ${
    service === 'apify'
      ? `const d=body.data;
  valid=object(d)&&object(d.monthlyUsageCycle)&&typeof d.monthlyUsageCycle.startAt==='string'&&typeof d.monthlyUsageCycle.endAt==='string'&&
    object(d.limits)&&Object.keys(d.limits).length>0&&Object.values(d.limits).every(number)&&
    object(d.current)&&Object.keys(d.current).length>0&&Object.values(d.current).every(number);`
      : ''
  }
  ${service === 'openai' ? `valid=body.object==='list'&&Array.isArray(body.data)&&body.data.every(m=>object(m)&&typeof m.id==='string');` : ''}
  ${service === 'vimeo' ? `valid=typeof body.uri==='string'&&/^\\/users\\/[A-Za-z0-9_-]+$/.test(body.uri);` : ''}
  ${service === 'youtube' ? `valid=body.kind==='youtube#channelListResponse'&&Array.isArray(body.items)&&body.items.length<=1&&body.items.every(c=>object(c)&&typeof c.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(c.id));` : ''}
}
const status=valid?'verified':error?failure:j.statusCode===401?'authentication_failed':j.statusCode===403?'access_denied':
  Number.isInteger(j.statusCode)?'http_rejected':'schema_rejected';
return [{json:{service:'${service}',status,authenticationVerified:valid,metadataSchemaVerified:valid,readOnly:true,
  actorStarted:false,inferencePerformed:false,budgetCapVerified:false}}];`
  );
}

export function buildCredentialProbe(input, service) {
  const b = parseN8nBindings(input);
  if (!['postgres', 'apify', 'openai', 'vimeo', 'youtube'].includes(service))
    throw new Error('EMR_N8N_CREDENTIAL_INCOMPATIBLE');
  if (!b.credentials?.[service]) throw new Error('EMR_N8N_BINDING_MISSING');
  const key = `M03-CREDENTIAL-${service.toUpperCase()}`;
  const native =
    service === 'postgres'
      ? {
          ...postgres(b, key, 'Read native identity', identitySql, '={{ [] }}', [480, 0]),
          retryOnFail: false,
          onError: 'continueRegularOutput',
        }
      : (() => {
          const auth = httpCredentialBinding(b, service);
          return {
            ...node(
              key,
              'Read provider metadata',
              'httpRequest',
              {
                method: 'GET',
                url: credentialProbeEndpoints[service],
                ...auth.parameters,
                sendQuery: false,
                sendHeaders: false,
                sendBody: false,
                options: {
                  timeout: 60000,
                  allowUnauthorizedCerts: false,
                  redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
                  sendCredentialsOnCrossOriginRedirect: false,
                  response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
                },
              },
              [480, 0],
            ),
            credentials: auth.credentials,
            retryOnFail: false,
            onError: 'continueRegularOutput',
          };
        })();
  delete native.maxTries;
  delete native.waitBetweenTries;
  return {
    key,
    kind: 'native-json-credential-probe-blueprint',
    hostedAcceptance: false,
    foundationAcceptance: false,
    temporaryProbeException: true,
    requestLimit:
      service === 'postgres'
        ? { databaseSelects: 1, providerRequests: 0 }
        : { databaseSelects: 0, providerRequests: 1 },
    requiredRefs: { credentialKeys: [service] },
    limitations:
      service === 'postgres'
        ? ['identity does not attest project host; compare saved public credential target separately']
        : [
            'metadata authentication only; no actor/inference/cap/collection acceptance',
            ...(service === 'youtube' ? ['one YouTube metadata quota unit per execution'] : []),
          ],
    workflow: {
      name: `M03 · Credential probe · ${service} [dev]`,
      active: false,
      nodes: [
        node(key, 'Manual credential check', 'manualTrigger', {}, [0, 0]),
        code(
          key,
          'Validate manual probe',
          inputPrelude + "if(!exact(j,['env'])) invalid(); return [{json:{env:'dev'}}];",
          [240, 0],
        ),
        native,
        code(
          key,
          'Project safe result',
          service === 'postgres' ? postgresProjection : providerProjection(service),
          [720, 0],
        ),
      ],
      connections: line(
        'Manual credential check',
        'Validate manual probe',
        native.name,
        'Project safe result',
      ),
      settings: {
        executionOrder: 'v1',
        timezone: 'Africa/Cairo',
        executionTimeout: 900,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
      },
      tags: [],
      pinData: {},
    },
  };
}
