import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGatewayPrivacy } from './gw01-privacy-read.mjs';
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
    { type: 'n8n-nodes-base.manualTrigger' },
    { type: 'n8n-nodes-base.code' },
    {
      type: 'n8n-nodes-base.httpRequest',
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
