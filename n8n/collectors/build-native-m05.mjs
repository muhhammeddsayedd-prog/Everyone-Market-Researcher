import { readFileSync } from 'node:fs';
import { parseN8nBindings, httpCredentialBinding } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  node,
  trigger,
  settings,
  tags,
  ref,
  line,
  edge,
  booleanIf,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import * as runtime from './native-m05-runtime.mjs';

const normalizer = readFileSync(new URL('../normalizers/youtubeApi.js', import.meta.url), 'utf8').split(
  /\nif\s*\(typeof module/,
)[0];
export const m05YoutubeCloudSource =
  normalizer +
  '\n' +
  Object.values(runtime)
    .map((fn) => fn.toString())
    .join('\n\n');
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object')throw Error('M05_NATIVE_INPUT_INVALID');const j=rows[0].json;\n";

export function nativeM05Http(bindings, key, name, service, url, body, position) {
  const auth =
    service === 'gateway'
      ? {
          parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth' },
          credentials: { httpCustomAuth: { id: bindings.credential.id, name: bindings.credential.name } },
        }
      : httpCredentialBinding(bindings, service);
  return {
    ...node(
      key,
      name,
      'httpRequest',
      {
        method: body === undefined ? 'GET' : 'POST',
        url,
        ...auth.parameters,
        sendQuery: false,
        sendHeaders: false,
        sendBody: body !== undefined,
        ...(body === undefined ? {} : { specifyBody: 'json', jsonBody: body }),
        options: {
          timeout: 25000,
          allowUnauthorizedCerts: false,
          redirect: { redirect: { followRedirects: false, maxRedirects: 0 } },
          sendCredentialsOnCrossOriginRedirect: false,
          response: { response: { responseFormat: 'json', fullResponse: true, neverError: true } },
        },
      },
      position,
    ),
    credentials: auth.credentials,
    retryOnFail: false,
    onError: 'continueRegularOutput',
  };
}

/** Author exact dev selectors into an inactive blueprint. A caller cannot choose
 * another account, provider host or operation. This does not save/activate it.
 */
export function buildNativeYoutube(input, transport, selection) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = 'WF-13';
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
  if (
    !selection ||
    Object.keys(selection).length !== 5 ||
    selection.env !== 'dev' ||
    !['daily', 'backfill'].includes(selection.mode) ||
    !Array.isArray(selection.account_ids) ||
    selection.account_ids.length < 1 ||
    selection.account_ids.length > 10 ||
    selection.account_ids.some((v) => !uuid(v)) ||
    new Set(selection.account_ids).size !== selection.account_ids.length ||
    !Number.isInteger(selection.max_pages) ||
    selection.max_pages < 1 ||
    selection.max_pages > (selection.mode === 'daily' ? 2 : 40) ||
    !Number.isInteger(selection.page_size) ||
    selection.page_size < 1 ||
    selection.page_size > 50
  )
    throw Error('M05_NATIVE_SELECTION_INVALID');
  const workflowSettings = settings(b, key);
  delete workflowSettings.errorWorkflow;
  Object.assign(workflowSettings, {
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  });
  const nodes = [
    trigger(key, [['env', 'string']]),
    code(
      key,
      'Initialize fixed YouTube selection',
      one +
        m05YoutubeCloudSource +
        `\nreturn[{json:initializeM05Youtube(${JSON.stringify(selection)},String($execution.id),new Date().toISOString())}];`,
      [200, 0],
    ),
    booleanIf(key, 'M05 gateway action?', "={{ $json.action === 'gateway' }}", [400, 0]),
    code(
      key,
      'Prepare M05 gateway',
      one +
        m05YoutubeCloudSource +
        '\nconst state=m05CheckQuotaDay(j,new Date().toISOString());return[{json:{state,request:state.request}}];',
      [600, -200],
    ),
    nativeM05Http(
      c,
      key,
      'Execute typed M05 gateway',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [800, -200],
    ),
    code(
      key,
      'Advance M05 gateway',
      one +
        m05YoutubeCloudSource +
        "\nconst state=$('Prepare M05 gateway').item.json.state;return[{json:advanceM05YoutubeGateway(state,j)}];",
      [1000, -200],
    ),
    booleanIf(key, 'YouTube HTTP action?', "={{ $json.action === 'youtube' }}", [600, 200]),
    code(key, 'Prepare YouTube API', one + 'return[{json:{state:j,http:j.http}}];', [800, 200]),
    nativeM05Http(
      b,
      key,
      'Read public YouTube metadata',
      'youtube',
      '={{ $json.http.url }}',
      undefined,
      [1000, 200],
    ),
    code(
      key,
      'Advance public YouTube response',
      one +
        m05YoutubeCloudSource +
        "\nconst state=$('Prepare YouTube API').item.json.state;return[{json:advanceM05YoutubeHttp(state,j)}];",
      [1200, 200],
    ),
    code(
      key,
      'Return YouTube collector result',
      one +
        "if(j.action!=='done'||!j.result)throw Error('M05_NATIVE_STATE_INVALID');return[{json:j.result}];",
      [800, 400],
    ),
  ];
  return {
    key,
    id: ref(b, key).id,
    kind: 'native-json-blueprint',
    hostedAcceptance: false,
    runnableWorkflow: true,
    liveEnabled: false,
    definitionProfile: 'inactive_native_staging',
    sourceProfile: {
      provider: 'youtube-api',
      publicOnly: true,
      actorFallbackEnabled: false,
      shortsClassification: 'duration_heuristic_unverified',
    },
    errorWorkflowBinding: { state: 'unresolved', reason: 'M05_handler_binding_pending' },
    requiredRefs: {
      workflowKeys: ['WF-13'],
      credentialKeys: ['youtube', 'foundationGateway'],
      tagNames: ['env:dev', 'layer:collector', 'platform:youtube'],
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      settings: workflowSettings,
      tags: tags(b, ['env:dev', 'layer:collector', 'platform:youtube']),
      pinData: {},
      connections: {
        ...line('When called', 'Initialize fixed YouTube selection', 'M05 gateway action?'),
        'M05 gateway action?': { main: [[edge('Prepare M05 gateway')], [edge('YouTube HTTP action?')]] },
        ...line(
          'Prepare M05 gateway',
          'Execute typed M05 gateway',
          'Advance M05 gateway',
          'M05 gateway action?',
        ),
        'YouTube HTTP action?': {
          main: [[edge('Prepare YouTube API')], [edge('Return YouTube collector result')]],
        },
        ...line(
          'Prepare YouTube API',
          'Read public YouTube metadata',
          'Advance public YouTube response',
          'M05 gateway action?',
        ),
      },
    },
  };
}
