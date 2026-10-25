import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readGatewayPrivacy,
  readRetainedGatewayCanary,
  privacyFailureStages,
  safePrivacyStage,
  safePrivacyParameterDiagnostic,
  privacyParameterPaths,
  privacyNativeSchema,
} from './gw01-privacy-read.mjs';
import { readFileSync } from 'node:fs';
const target = {
  workflowId: 'SyntheticOwned',
  executionId: '123',
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
};
const workflow = () => ({
  id: target.workflowId,
  name: 'M03 gateway acceptance [dev]',
  active: false,
  nodes: [
    { id: 'SyntheticManual', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1 },
    { id: 'SyntheticReceipt', type: 'n8n-nodes-base.set', typeVersion: 3.4 },
    {
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      id: 'SyntheticHttpNode',
      name: 'Call fixed dev worker',
      parameters: {
        url: target.audience + '/api/internal/n8n/rpc',
        method: 'POST',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpCustomAuth',
      },
      retryOnFail: false,
      credentials: { httpCustomAuth: { id: 'EmrGw01Canary18', name: 'M03 GW-01 privacy canary [dev]' } },
    },
  ],
  pinData: {},
  settings: {
    saveDataErrorExecution: 'none',
    saveDataSuccessExecution: 'none',
    saveManualExecutions: false,
    saveExecutionProgress: false,
  },
});
test('privacy read is limited to exact owned IDs and projects only booleans/IDs', async () => {
  const calls = [];
  const out = await readGatewayPrivacy(target, async (method, path) => {
    calls.push({ method, path });
    return {
      status: 200,
      body: path.includes('workflows')
        ? workflow()
        : {
            id: target.executionId,
            workflowId: target.workflowId,
            status: 'success',
            workflowData: workflow(),
            data: {
              resultData: {
                runData: {
                  'Call fixed dev worker': [
                    {
                      startTime: 123,
                      executionTime: 12,
                      source: [],
                      data: { main: [[{ json: { statusCode: 403, body: {} } }]] },
                    },
                  ],
                },
              },
            },
          },
    };
  });
  assert.equal(out.executionCanaryVerified, true);
  assert.equal(out.httpStatusCode, 403);
  assert.deepEqual(calls, [
    { method: 'GET', path: '/api/v1/workflows/SyntheticOwned' },
    { method: 'GET', path: '/api/v1/executions/123?includeData=true' },
  ]);
  assert.equal(Object.hasOwn(out, 'data'), false);
});
test('disabled execution retention yielding404 remains explicit unverified gate', async () => {
  const out = await readGatewayPrivacy(target, async (_m, path) =>
    path.includes('workflows') ? { status: 200, body: workflow() } : { status: 404, body: {} },
  );
  assert.equal(out.status, 'execution_unavailable');
  assert.equal(out.executionCanaryVerified, false);
  assert.equal(out.httpStatusCode, null);
});
for (const change of ['canary', 'active', 'credential', 'pin', 'authentication'])
  test('privacy read rejects ' + change + ' before any execution call', async () => {
    let calls = 0;
    const w = workflow();
    if (change === 'canary') w.nodes[0].data = 'GW01_SYNTHETIC_AUTH_CANARY_ONLY';
    if (change === 'active') w.active = true;
    if (change === 'credential') w.nodes[2].credentials.httpCustomAuth.id = 'Unrelated';
    if (change === 'pin') w.pinData = { x: [] };
    if (change === 'authentication') w.nodes[2].parameters.authentication = 'none';
    await assert.rejects(
      readGatewayPrivacy(target, async () => {
        calls++;
        return { status: 200, body: w };
      }),
      /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
    );
    assert.equal(calls, 1);
  });
test('execution header/error canary leakage is withheld rather than falsely passing redaction', async () => {
  await assert.rejects(
    readGatewayPrivacy(target, async (_m, path) => ({
      status: 200,
      body: path.includes('workflows')
        ? workflow()
        : {
            id: '123',
            workflowId: target.workflowId,
            status: 'error',
            data: { error: { headers: { authorization: 'GW01_SYNTHETIC_AUTH_CANARY_ONLY' } } },
          },
    })),
    /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
  );
});
for (const data of [
  {},
  [],
  { resultData: { runData: {} } },
  { resultData: { runData: { 'Call fixed dev worker': [] } } },
])
  test('metadata-only or empty execution content cannot prove canary HTTP execution', async () => {
    await assert.rejects(
      readGatewayPrivacy(target, async (_m, path) => ({
        status: 200,
        body: path.includes('workflows')
          ? workflow()
          : { id: '123', workflowId: target.workflowId, status: 'success', data },
      })),
      /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
    );
  });
test('historical authnone execution cannot inherit current canary credential config', async () => {
  const executed = workflow();
  executed.nodes[2].parameters.authentication = 'none';
  await assert.rejects(
    readGatewayPrivacy(target, async (_m, path) => ({
      status: 200,
      body: path.includes('workflows')
        ? workflow()
        : {
            id: '123',
            workflowId: target.workflowId,
            status: 'success',
            workflowData: executed,
            data: {
              resultData: {
                runData: {
                  'Call fixed dev worker': [
                    {
                      startTime: 123,
                      executionTime: 12,
                      source: [],
                      data: { main: [[{ json: { statusCode: 403 } }]] },
                    },
                  ],
                },
              },
            },
          },
    })),
    /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
  );
});
test('explicit FAKE-only retained path requires restored current settings and actualcanarysnapshot while strict path keepsrejecting', async () => {
  const current = workflow(),
    executed = workflow();
  executed.settings.saveDataErrorExecution = 'all';
  executed.settings.saveDataSuccessExecution = 'all';
  executed.settings.saveManualExecutions = true;
  const port = async (_m, path) => ({
    status: 200,
    body: path.includes('workflows')
      ? current
      : {
          id: '123',
          workflowId: target.workflowId,
          status: 'success',
          workflowData: executed,
          data: {
            resultData: {
              runData: {
                'Call fixed dev worker': [
                  {
                    startTime: 123,
                    executionTime: 12,
                    source: [],
                    data: { main: [[{ json: { statusCode: 401, body: 'Protected preview HTML' } }]] },
                  },
                ],
              },
            },
          },
        },
  });
  assert.equal((await readRetainedGatewayCanary(target, port)).executionCanaryVerified, true);
  await assert.rejects(readGatewayPrivacy(target, port), /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/);
  current.settings.saveManualExecutions = true;
  await assert.rejects(readRetainedGatewayCanary(target, port), /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/);
});
test('FAKE-retained privacy path cannot inspect an executed machinecredential or an extraHTTPbranch', async () => {
  for (const drift of ['machine', 'extra']) {
    const current = workflow(),
      executed = workflow();
    executed.settings = {
      ...executed.settings,
      saveDataErrorExecution: 'all',
      saveDataSuccessExecution: 'all',
      saveManualExecutions: true,
    };
    if (drift === 'machine')
      executed.nodes[2].credentials.httpCustomAuth = {
        id: 'EmrGw01Machine18',
        name: 'M03 GW-01 machine [dev]',
      };
    else executed.nodes.push({ type: 'n8n-nodes-base.httpRequest', id: 'Unexpected', name: 'Unexpected' });
    await assert.rejects(
      readRetainedGatewayCanary(target, async (_m, path) => ({
        status: 200,
        body: path.includes('workflows')
          ? current
          : { id: '123', workflowId: target.workflowId, status: 'success', workflowData: executed, data: {} },
      })),
      /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
    );
  }
});
const execution = (current) => ({
  id: target.executionId,
  workflowId: target.workflowId,
  status: 'success',
  workflowData: structuredClone(current),
  data: {
    resultData: {
      runData: {
        'Call fixed dev worker': [
          {
            startTime: 123,
            executionTime: 12,
            source: [],
            data: { main: [[{ json: { statusCode: 401, body: 'Synthetic public body' } }]] },
          },
        ],
      },
    },
  },
});
const stageCases = [
  [
    'current_workflow_http',
    (w) => {
      w.status = 500;
    },
  ],
  [
    'current_workflow_identity',
    (w) => {
      w.body.id = 'Other';
    },
  ],
  [
    'current_workflow_state',
    (w) => {
      w.body.active = true;
    },
  ],
  [
    'current_workflow_shape',
    (w) => {
      w.body.pinData = { unexpected: [] };
    },
  ],
  [
    'current_workflow_canary_reflection',
    (w) => {
      w.body.extra = 'GW01_SYNTHETIC_AUTH_CANARY_ONLY';
    },
  ],
  [
    'current_settings',
    (w) => {
      w.body.settings.saveManualExecutions = true;
    },
  ],
  [
    'current_http_node',
    (w) => {
      w.body.nodes[2].parameters.authentication = 'none';
    },
  ],
  [
    'current_credential',
    (w) => {
      w.body.nodes[2].credentials.httpCustomAuth.id = 'Other';
    },
  ],
  [
    'current_other_credentials',
    (w) => {
      w.body.nodes[0].credentials = { unexpected: { id: 'Other' } };
    },
  ],
  [
    'execution_http',
    (_w, e) => {
      e.status = 500;
    },
  ],
  [
    'execution_envelope',
    (_w, e) => {
      e.body.workflowId = 'Other';
    },
  ],
  [
    'execution_status',
    (_w, e) => {
      e.body.status = 'running';
    },
  ],
  [
    'execution_canary_reflection',
    (_w, e) => {
      e.body.extra = 'GW01_SYNTHETIC_BYPASS_CANARY_ONLY';
    },
  ],
  [
    'execution_data',
    (_w, e) => {
      e.body.data = [];
    },
  ],
  [
    'executed_settings',
    (_w, e) => {
      e.body.workflowData.settings.saveManualExecutions = true;
    },
  ],
  [
    'executed_snapshot_workflow_id',
    (_w, e) => {
      e.body.workflowData.id = 'Other';
    },
  ],
  [
    'executed_snapshot_http_id_count',
    (_w, e) => {
      e.body.workflowData.nodes[2].id = 'Other';
    },
  ],
  [
    'executed_snapshot_name',
    (_w, e) => {
      e.body.workflowData.nodes[2].name = 'Other';
    },
  ],
  [
    'executed_snapshot_type',
    (_w, e) => {
      e.body.workflowData.nodes[2].type = 'Other';
    },
  ],
  [
    'executed_snapshot_type_version',
    (_w, e) => {
      e.body.workflowData.nodes[2].typeVersion = 999;
    },
  ],
  [
    'executed_snapshot_parameters',
    (_w, e) => {
      e.body.workflowData.nodes[2].parameters.method = 'Other';
    },
  ],
  [
    'executed_snapshot_credentials',
    (_w, e) => {
      e.body.workflowData.nodes[2].credentials.httpCustomAuth.name = 'Other';
    },
  ],
  [
    'executed_snapshot_retry_on_fail',
    (_w, e) => {
      delete e.body.workflowData.nodes[2].retryOnFail;
    },
  ],
  [
    'executed_snapshot_on_error',
    (_w, e) => {
      e.body.workflowData.nodes[2].onError = 'Other';
    },
  ],
  [
    'executed_graph_match',
    (_w, e) => {
      e.body.workflowData.connections = { unrelated: {} };
    },
  ],
  [
    'native_http_task',
    (_w, e) => {
      e.body.data.resultData.runData['Call fixed dev worker'] = [];
    },
  ],
  [
    'native_http_status',
    (_w, e) => {
      e.body.data.resultData.runData['Call fixed dev worker'][0].data.main[0][0].json.statusCode = '401';
    },
  ],
];
for (const [stage, mutate] of stageCases)
  test('finite privacy failure stage: ' + stage, async () => {
    const current = workflow(),
      w = { status: 200, body: current },
      e = { status: 200, body: execution(current) };
    mutate(w, e);
    let error;
    try {
      await readGatewayPrivacy(target, async (_method, path) => (path.includes('/workflows/') ? w : e));
    } catch (caught) {
      error = caught;
    }
    assert.equal(error?.message, 'GW01_DELIVERY_RESPONSE_REJECTED');
    assert.equal(safePrivacyStage(error), stage);
    assert.deepEqual(
      Object.keys(error),
      stage === 'executed_snapshot_parameters'
        ? ['privacyStage', 'privacyParameterDiagnostic']
        : ['privacyStage'],
    );
    assert.doesNotMatch(
      JSON.stringify(error),
      /Other|Synthetic public body|AUTH_CANARY_ONLY|BYPASS_CANARY_ONLY/,
    );
  });
test('invalid target and unknown error attributes cannot escape the closed diagnostic enum', async () => {
  await assert.rejects(
    readGatewayPrivacy({ ...target, audience: 'SYNTHETIC_PRIVATE_TARGET' }, () => assert.fail('no read')),
    (error) => error.message === 'GW01_DELIVERY_RESPONSE_REJECTED' && safePrivacyStage(error) === 'target',
  );
  assert.equal(safePrivacyStage({ privacyStage: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' }), null);
  assert.ok(Object.isFrozen(privacyFailureStages));
});
test('historical CloudA saved export passes canary assertions without claiming current runtime or execution acceptance', async () => {
  const actual = JSON.parse(readFileSync('n8n/fixtures/GW01-cloud-a-saved-export.json', 'utf8'));
  const http = actual.nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest'),
    url = http.parameters.url;
  const actualTarget = {
    workflowId: actual.id,
    executionId: '12674',
    audience: url.slice(0, -'/api/internal/n8n/rpc'.length),
  };
  let reads = 0;
  const out = await readRetainedGatewayCanary(actualTarget, async (_method, path) => {
    reads++;
    return path.includes('/workflows/') ? { status: 200, body: actual } : { status: 404, body: {} };
  });
  assert.equal(reads, 2);
  assert.equal(out.exportCanaryVerified, true);
  assert.equal(out.executionCanaryVerified, false);
  assert.equal(out.httpStatusCode, null);
});
test('GET execution numeric identity is rejected without normalization', async () => {
  const current = workflow(),
    e = execution(current);
  e.id = 123;
  await assert.rejects(
    readGatewayPrivacy(target, async (_method, path) =>
      path.includes('/workflows/') ? { status: 200, body: current } : { status: 200, body: e },
    ),
    (error) =>
      error.message === 'GW01_DELIVERY_RESPONSE_REJECTED' && safePrivacyStage(error) === 'execution_envelope',
  );
});
test('native rejection annotates the exact read with a fixed stage without copying error details', async () => {
  for (const second of [false, true]) {
    const privateError = Error('SYNTHETIC_PRIVATE_NATIVE_DETAILS');
    let error;
    try {
      await readGatewayPrivacy(target, async (_method, path) => {
        if (!second || path.includes('/executions/')) throw privateError;
        return { status: 200, body: workflow() };
      });
    } catch (caught) {
      error = caught;
    }
    assert.equal(safePrivacyStage(error), second ? 'execution_http' : 'current_workflow_http');
    assert.doesNotMatch(JSON.stringify(error), /SYNTHETIC_PRIVATE_NATIVE_DETAILS/);
  }
});
test('Windows and JavaScript accept exactly the same finite privacy stage enum', () => {
  const ps = readFileSync('scripts/n8n/windows/Invoke-M03GW01Delivery.ps1', 'utf8'),
    match = ps.match(/\$privacyStages=@\(([^\r\n]+)\)/);
  assert.ok(match);
  assert.deepEqual(
    [...match[1].matchAll(/'([^']+)'/g)].map((v) => v[1]),
    privacyFailureStages,
  );
  assert.deepEqual(
    [...ps.match(/\$privacyParameterPaths=@\(([^\r\n]+)\)/)[1].matchAll(/'([^']+)'/g)].map((v) => v[1]),
    privacyParameterPaths,
  );
  for (const [node, schema] of Object.entries(privacyNativeSchema))
    assert.deepEqual(
      [...ps.match(new RegExp('^' + node + '=@\\(([^\\r\\n]+)\\)', 'm'))[1].matchAll(/'([^']+)'/g)].map(
        (v) => v[1],
      ),
      Object.keys(schema.defaults),
    );
});

test('all differing known parameter paths are projected without values and JSON equivalence does not pass exact mismatch', async () => {
  const current = workflow();
  current.nodes[2].parameters.jsonBody = '{"version":1,"operation":"identity"}';
  current.nodes[2].parameters.options = {
    allowUnauthorizedCerts: false,
    redirect: { redirect: { followRedirects: false } },
    response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } },
    timeout: 25000,
    sendCredentialsOnCrossOriginRedirect: false,
  };
  const e = execution(current),
    p = e.workflowData.nodes[2].parameters;
  p.method = 'SYNTHETIC_PRIVATE_METHOD';
  p.jsonBody = '{ "operation": "identity", "version": 1 }';
  p.options.timeout = 1;
  p.options.response.response.fullResponse = false;
  p.SYNTHETIC_PRIVATE_DYNAMIC_KEY = 'SYNTHETIC_PRIVATE_DYNAMIC_VALUE';
  let error;
  try {
    await readGatewayPrivacy(target, async (_method, path) => ({
      status: 200,
      body: path.includes('/workflows/') ? current : e,
    }));
  } catch (caught) {
    error = caught;
  }
  assert.equal(safePrivacyStage(error), 'executed_snapshot_parameters');
  const { nativeSchema, ...known } = safePrivacyParameterDiagnostic(error);
  assert.equal(nativeSchema.length, 3);
  assert.deepEqual(known, {
    paths: [
      'method',
      'jsonBody',
      'options.response.response.fullResponse',
      'options.timeout',
      'parameters_other',
    ],
    jsonBodyTextDifferent: true,
    jsonBodySemanticEqual: true,
  });
  assert.doesNotMatch(JSON.stringify(error), /SYNTHETIC_PRIVATE|"operation"|"identity"|25000/);
});

for (const [left, right, expected] of [
  ['{"version":1}', '{"version":2}', false],
  ['not-json', 'other-not-json', null],
  [{ version: 1 }, '{"version":1}', null],
])
  test(
    'JSON body diagnostic stays boolean or null for unequal or unparsable bodies: ' + String(expected),
    async () => {
      const current = workflow();
      current.nodes[2].parameters.jsonBody = left;
      const e = execution(current);
      e.workflowData.nodes[2].parameters.jsonBody = right;
      await assert.rejects(
        readGatewayPrivacy(target, async (_method, path) => ({
          status: 200,
          body: path.includes('/workflows/') ? current : e,
        })),
        (error) => {
          assert.equal(safePrivacyParameterDiagnostic(error).jsonBodySemanticEqual, expected);
          return safePrivacyStage(error) === 'executed_snapshot_parameters';
        },
      );
    },
  );

test('parameter diagnostic sanitizer cannot emit dynamic paths, wrong shapes or data on another stage', () => {
  const base = {
    privacyStage: 'executed_snapshot_parameters',
    privacyParameterDiagnostic: {
      paths: ['jsonBody'],
      jsonBodyTextDifferent: true,
      jsonBodySemanticEqual: true,
      nativeSchema: ['manual', 'http', 'receipt'].map((node) => ({
        node,
        identityMatched: true,
        differences: [],
        unclassifiedDifference: false,
      })),
    },
  };
  assert.equal(safePrivacyParameterDiagnostic({ ...base, privacyStage: 'executed_settings' }), null);
  for (const change of [
    { paths: ['SYNTHETIC_PRIVATE_DYNAMIC_PATH'] },
    { paths: ['jsonBody', 'jsonBody'] },
    { jsonBodyTextDifferent: 'SYNTHETIC_PRIVATE_VALUE' },
    { extra: 'SYNTHETIC_PRIVATE_VALUE' },
  ])
    assert.equal(
      safePrivacyParameterDiagnostic({
        ...base,
        privacyParameterDiagnostic: { ...base.privacyParameterDiagnostic, ...change },
      }),
      null,
    );
  for (const mutate of [
    (d) => {
      d.nativeSchema[0].node = 'UNSUPPORTED_NODE';
    },
    (d) => {
      d.nativeSchema[0].differences = [
        {
          path: 'UNSUPPORTED_PATH',
          currentPresent: false,
          executedPresent: true,
          currentDefaultEqual: null,
          executedDefaultEqual: true,
        },
      ];
    },
    (d) => {
      d.nativeSchema[0].differences = [
        {
          path: 'notice',
          currentPresent: false,
          executedPresent: true,
          currentDefaultEqual: false,
          executedDefaultEqual: true,
        },
      ];
    },
    (d) => {
      d.nativeSchema[0].unclassifiedDifference = 'PRIVATE_VALUE';
    },
  ]) {
    const altered = structuredClone(base);
    mutate(altered.privacyParameterDiagnostic);
    assert.equal(safePrivacyParameterDiagnostic(altered), null);
  }
});

test('one rejected read identifies every known differing leaf using only fixed paths', async () => {
  const current = workflow(),
    e = execution(current);
  for (const path of privacyParameterPaths.slice(0, -1)) {
    const parts = path.split('.');
    let p = e.workflowData.nodes[2].parameters;
    for (const key of parts.slice(0, -1)) p = p[key] ??= {};
    p[parts.at(-1)] = 'SYNTHETIC_PRIVATE_VALUE';
  }
  await assert.rejects(
    readGatewayPrivacy(target, async (_method, path) => ({
      status: 200,
      body: path.includes('/workflows/') ? current : e,
    })),
    (error) => {
      assert.deepEqual(safePrivacyParameterDiagnostic(error).paths, privacyParameterPaths.slice(0, -1));
      assert.doesNotMatch(JSON.stringify(error), /SYNTHETIC_PRIVATE_VALUE/);
      return error.message === 'GW01_DELIVERY_RESPONSE_REJECTED';
    },
  );
});

test('one rejected read projects all three native-node schema differences as presence/default booleans only', async () => {
  const current = workflow(),
    e = execution(current);
  current.nodes[0].parameters = {};
  current.nodes[1].parameters = {};
  e.workflowData.nodes[0].parameters = { notice: '' };
  e.workflowData.nodes[1].parameters = { mode: 'manual' };
  e.workflowData.nodes[2].parameters.contentType = 'unsupported';
  await assert.rejects(
    readGatewayPrivacy(target, async (_method, path) => ({
      status: 200,
      body: path.includes('/workflows/') ? current : e,
    })),
    (error) => {
      const d = safePrivacyParameterDiagnostic(error);
      assert.equal(d.nativeSchema.length, 3);
      for (const [node, path] of [
        ['manual', 'notice'],
        ['http', 'contentType'],
        ['receipt', 'mode'],
      ]) {
        const row = d.nativeSchema.find((r) => r.node === node);
        assert.equal(row.identityMatched, true);
        assert.equal(row.unclassifiedDifference, false);
        assert.deepEqual(row.differences, [
          {
            path,
            currentPresent: false,
            executedPresent: true,
            currentDefaultEqual: null,
            executedDefaultEqual: node !== 'http',
          },
        ]);
        assert.ok(Object.hasOwn(privacyNativeSchema[node].defaults, path));
      }
      assert.doesNotMatch(JSON.stringify(d), /"json"|"manual".*"mode":"manual"|SYNTHETIC_PRIVATE/);
      return error.message === 'GW01_DELIVERY_RESPONSE_REJECTED';
    },
  );
});

function observedDefaultPair() {
  const current = workflow();
  current.nodes[0].parameters = {};
  current.nodes[1].parameters = {};
  current.nodes[2].parameters.options = { response: { response: { responseFormat: 'text' } } };
  current.nodes[2].parameters.sendBody = true;
  current.nodes[2].parameters.jsonBody = '{"operation":"identity"}';
  const e = execution(current);
  Object.assign(e.workflowData.nodes[0].parameters, { notice: '' });
  Object.assign(e.workflowData.nodes[1].parameters, {
    mode: 'manual',
    duplicateItem: false,
    includeOtherFields: false,
  });
  Object.assign(e.workflowData.nodes[2].parameters, {
    curlImport: '',
    provideSslCertificates: false,
    sendQuery: false,
    sendHeaders: false,
    contentType: 'json',
    infoMessage: '',
  });
  e.workflowData.nodes[2].parameters.options.response.response.outputPropertyName = 'data';
  return { current, e };
}
test('source-defined observed defaults reconcile both complete graphs without mutating either response', async () => {
  const { current, e } = observedDefaultPair(),
    before = JSON.stringify({ current, e });
  const out = await readGatewayPrivacy(target, async (_method, path) => ({
    status: 200,
    body: path.includes('/workflows/') ? current : e,
  }));
  assert.equal(out.executionCanaryVerified, true);
  assert.equal(JSON.stringify({ current, e }), before);
});
test('source-defined output field also applies only to the existing file response format', async () => {
  const { current, e } = observedDefaultPair();
  current.nodes[2].parameters.options.response.response.responseFormat = 'file';
  e.workflowData.nodes[2].parameters.options.response.response.responseFormat = 'file';
  const out = await readGatewayPrivacy(target, async (_method, path) => ({
    status: 200,
    body: path.includes('/workflows/') ? current : e,
  }));
  assert.equal(out.executionCanaryVerified, true);
});
for (const [label, change] of [
  [
    'manual wrong version',
    ({ current, e }) => {
      current.nodes[0].typeVersion = 2;
      e.workflowData.nodes[0].typeVersion = 2;
    },
  ],
  [
    'HTTP wrong version',
    ({ current, e }) => {
      current.nodes[2].typeVersion = 4.4;
      e.workflowData.nodes[2].typeVersion = 4.4;
    },
  ],
  [
    'Set wrong version',
    ({ current, e }) => {
      current.nodes[1].typeVersion = 3.3;
      e.workflowData.nodes[1].typeVersion = 3.3;
    },
  ],
  [
    'nondefault manual notice',
    ({ e }) => {
      e.workflowData.nodes[0].parameters.notice = 'UNAPPROVED';
    },
  ],
  [
    'nondefault query option',
    ({ e }) => {
      e.workflowData.nodes[2].parameters.sendQuery = true;
    },
  ],
  [
    'nondefault Set include',
    ({ e }) => {
      e.workflowData.nodes[1].parameters.includeOtherFields = true;
    },
  ],
  [
    'nondefault nested output',
    ({ e }) => {
      e.workflowData.nodes[2].parameters.options.response.response.outputPropertyName = 'UNAPPROVED';
    },
  ],
  [
    'JSON response format',
    ({ current, e }) => {
      current.nodes[2].parameters.options.response.response.responseFormat = 'json';
      e.workflowData.nodes[2].parameters.options.response.response.responseFormat = 'json';
    },
  ],
  [
    'unknown response format',
    ({ current, e }) => {
      current.nodes[2].parameters.options.response.response.responseFormat = 'UNAPPROVED';
      e.workflowData.nodes[2].parameters.options.response.response.responseFormat = 'UNAPPROVED';
    },
  ],
  [
    'missing nested containers',
    ({ e }) => {
      delete e.workflowData.nodes[2].parameters.options.response;
    },
  ],
  [
    'body-disabled hidden content type',
    ({ current, e }) => {
      current.nodes[2].parameters.sendBody = false;
      e.workflowData.nodes[2].parameters.sendBody = false;
    },
  ],
  [
    'Set raw-mode hidden defaults',
    ({ current, e }) => {
      current.nodes[1].parameters.mode = 'raw';
      e.workflowData.nodes[1].parameters.mode = 'raw';
    },
  ],
  [
    'malformed executed non-HTTP node',
    ({ e }) => {
      e.workflowData.nodes[0] = null;
    },
  ],
  [
    'unknown parameter',
    ({ e }) => {
      e.workflowData.nodes[2].parameters.UNAPPROVED = true;
    },
  ],
  [
    'existing nondefault overwritten',
    ({ current }) => {
      current.nodes[2].parameters.sendQuery = true;
    },
  ],
  [
    'body text rewritten',
    ({ e }) => {
      e.workflowData.nodes[2].parameters.jsonBody = '{ "operation": "identity" }';
    },
  ],
  [
    'credential name changed',
    ({ e }) => {
      e.workflowData.nodes[2].credentials.httpCustomAuth.name = 'UNAPPROVED';
    },
  ],
  [
    'connection changed',
    ({ e }) => {
      e.workflowData.connections = { UNAPPROVED: {} };
    },
  ],
])
  test('representation correction still rejects ' + label, async () => {
    const pair = observedDefaultPair();
    change(pair);
    await assert.rejects(
      readGatewayPrivacy(target, async (_method, path) => ({
        status: 200,
        body: path.includes('/workflows/') ? pair.current : pair.e,
      })),
      /^Error: GW01_DELIVERY_RESPONSE_REJECTED$/,
    );
  });
