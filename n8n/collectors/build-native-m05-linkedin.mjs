import { readFileSync } from 'node:fs';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  code,
  trigger,
  settings,
  tags,
  ref,
  line,
  edge,
  booleanIf,
} from '../foundation/build-foundation.mjs';
import { parseCollectorTransport } from './build-native-collectors.mjs';
import { nativeM05Http } from './build-native-m05.mjs';
import { m05RequestId, m05Gateway } from './native-m05-runtime.mjs';
import {
  buildLinkedInPostBatches,
  buildLinkedInEmployeeBatches,
  linkedinRegistrationCompletion,
  linkedinPlanningHelpers,
} from './linkedin.mjs';
import * as runtime from './native-m05-linkedin.mjs';

const normalizer = readFileSync(new URL('../normalizers/linkedinPosts.js', import.meta.url), 'utf8').split(
  "if (typeof module !== 'undefined')",
)[0];
const helpers = Object.entries(linkedinPlanningHelpers)
  .map(([name, fn]) => `const ${name}=${fn.toString()};`)
  .join('\n');
export const m05LinkedInCloudSource = [
  normalizer,
  helpers,
  linkedinRegistrationCompletion.toString(),
  buildLinkedInPostBatches.toString(),
  buildLinkedInEmployeeBatches.toString(),
  m05RequestId.toString(),
  m05Gateway.toString(),
  ...Object.values(runtime).map((fn) => fn.toString()),
].join('\n\n');
const one =
  "const rows=$input.all();if(rows.length!==1||!rows[0].json||typeof rows[0].json!=='object')throw Error('M05_NATIVE_INPUT_INVALID');const j=rows[0].json;\n";

/** Offline-only blueprint with authored exact IDs. Saving/publication still needs a live packet. */
export function buildNativeLinkedIn(input, transport, kind, selection) {
  const b = parseN8nBindings(input),
    c = parseCollectorTransport(transport),
    key = kind === 'posts' ? 'WF-18' : 'WF-18b';
  // Reuse the same pure guard before writing any local definition.
  runtime.initializeM05LinkedIn(selection, kind, '1', '2026-10-28T00:00:00Z');
  const workflowSettings = settings(b, key);
  delete workflowSettings.errorWorkflow;
  Object.assign(workflowSettings, {
    executionTimeout: 1800,
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  });
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
        requestUrl: b.instanceUrl + '/webhook/emr-apify-callback',
      },
    ]),
    'utf8',
  ).toString('base64');
  const nodes = [
    trigger(key, [['env', 'string']]),
    code(
      key,
      'Initialize fixed LinkedIn selection',
      one +
        m05LinkedInCloudSource +
        `\nreturn[{json:initializeM05LinkedIn(${JSON.stringify(selection)},${JSON.stringify(kind)},String($execution.id),new Date().toISOString())}];`,
      [200, 0],
    ),
    booleanIf(key, 'M05 LinkedIn gateway action?', "={{ $json.action === 'gateway' }}", [400, 0]),
    code(key, 'Prepare LinkedIn gateway', one + 'return[{json:{state:j,request:j.request}}];', [600, -200]),
    nativeM05Http(
      c,
      key,
      'Execute typed LinkedIn gateway',
      'gateway',
      c.audience + '/api/internal/n8n/collectors',
      '={{ $json.request }}',
      [800, -200],
    ),
    code(
      key,
      'Advance LinkedIn gateway',
      one +
        m05LinkedInCloudSource +
        "\nconst prior=$('Prepare LinkedIn gateway').item.json.state;return[{json:advanceM05LinkedInGateway(prior,j)}];",
      [1000, -200],
    ),
    booleanIf(key, 'LinkedIn actor action?', "={{ $json.action === 'apify' }}", [600, 200]),
    code(key, 'Prepare LinkedIn actor', one + 'return[{json:j}];', [800, 200]),
    nativeM05Http(
      b,
      key,
      'Start asynchronous LinkedIn actor',
      'apify',
      '={{ "https://api.apify.com/v2/acts/"+$json.launchDescriptor.actorPath+"/runs?waitForFinish=0&restartOnError=false&timeout="+$json.launchDescriptor.timeout+"&memory=1024&build="+encodeURIComponent($json.launchDescriptor.build)+"&maxItems="+$json.launchDescriptor.maxItems+"&maxTotalChargeUsd="+$json.launchDescriptor.maxTotalChargeUsd+"&webhooks=' +
        encodeURIComponent(webhooks) +
        '" }}',
      '={{ $json.batches[$json.batchIndex].input }}',
      [1000, 200],
    ),
    code(
      key,
      'Advance LinkedIn actor response',
      one +
        m05LinkedInCloudSource +
        "\nconst prior=$('Prepare LinkedIn actor').item.json;return[{json:advanceM05LinkedInActor(prior,j)}];",
      [1200, 200],
    ),
    code(
      key,
      'Return LinkedIn dispatch result',
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
    fixtureProvenance: {
      kind: 'synthetic_local_contract',
      actualProviderCapture: false,
      actualNativeSave: false,
      requiresApprovedRealSelectors: true,
    },
    sourceProfile: {
      provider:
        kind === 'posts' ? 'harvestapi/linkedin-company-posts' : 'harvestapi/linkedin-company-employees',
      publicOnly: true,
      captureEvidence: 'synthetic_local_only',
      ...(kind === 'posts' ? { repostShapeVerified: false } : { employeeCoverageComplete: false }),
    },
    errorWorkflowBinding: { state: 'unresolved', reason: 'M05_handler_publication_not_authorized' },
    requiredRefs: {
      workflowKeys: [key, 'WF-19'],
      credentialKeys: ['apify', 'foundationGateway'],
      tagNames: [
        'env:dev',
        'layer:collector',
        kind === 'posts' ? 'platform:linkedin' : 'platform:linkedin_employees',
      ],
    },
    workflow: {
      name: ref(b, key).name,
      active: false,
      nodes,
      settings: workflowSettings,
      tags: tags(b, [
        'env:dev',
        'layer:collector',
        kind === 'posts' ? 'platform:linkedin' : 'platform:linkedin_employees',
      ]),
      pinData: {},
      connections: {
        ...line('When called', 'Initialize fixed LinkedIn selection', 'M05 LinkedIn gateway action?'),
        'M05 LinkedIn gateway action?': {
          main: [[edge('Prepare LinkedIn gateway')], [edge('LinkedIn actor action?')]],
        },
        ...line(
          'Prepare LinkedIn gateway',
          'Execute typed LinkedIn gateway',
          'Advance LinkedIn gateway',
          'M05 LinkedIn gateway action?',
        ),
        'LinkedIn actor action?': {
          main: [[edge('Prepare LinkedIn actor')], [edge('Return LinkedIn dispatch result')]],
        },
        ...line(
          'Prepare LinkedIn actor',
          'Start asynchronous LinkedIn actor',
          'Advance LinkedIn actor response',
          'M05 LinkedIn gateway action?',
        ),
      },
    },
  };
}
