import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFoundationNativeDomainProbe,
  projectFoundationNativeDomainDenial,
  foundationNativeDomainProbe,
} from './foundation-live-domain-probe.mjs';

const runtimeAudience = 'https://everyone-market-researcher-new-runtime-acceptance.vercel.app';
const settings = {
  saveManualExecutions: true,
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'none',
  saveExecutionProgress: false,
  availableInMCP: true,
  executionTimeout: 900,
  errorWorkflow: 'owned-WF90-reference',
};
function fixture() {
  const { workflow: body } = buildFoundationNativeDomainProbe({ runtimeAudience, settings });
  const message = `Domain not allowed: This credential is restricted from accessing ${new URL(foundationNativeDomainProbe.targetAudience).host}. Only the following domains are allowed: ${new URL(runtimeAudience).host}`;
  const error = {
    name: 'NodeApiError',
    message,
    httpCode: null,
    node: structuredClone(body.nodes[1]),
    context: {
      itemIndex: 0,
      request: { method: 'POST', uri: body.nodes[1].parameters.url, allowedDomains: '**hidden**' },
    },
  };
  return {
    body,
    resultData: {
      error: structuredClone(error),
      runData: {
        [body.nodes[0].name]: [{ data: { main: [[{ json: {} }]] } }],
        [body.nodes[1].name]: [{ error: structuredClone(error) }],
      },
    },
  };
}
test('fixed WF99 probe has only the owned Machine HTTP call to the disabled old audience', () => {
  const packet = JSON.parse(readFileSync(new URL('./foundation-delivery-packet.json', import.meta.url)));
  assert.equal(foundationNativeDomainProbe.targetAudience, packet.audience);
  const { workflow } = buildFoundationNativeDomainProbe({ runtimeAudience, settings });
  assert.equal(workflow.nodes.length, 2);
  assert.equal(workflow.nodes[1].parameters.url, packet.audience + '/api/internal/n8n/foundation');
  assert.equal(workflow.nodes[1].credentials.httpCustomAuth.id, 'EmrM03Machine19');
  assert.equal(workflow.nodes[1].retryOnFail, false);
  assert.equal(workflow.nodes[1].onError, 'stopWorkflow');
  assert.equal(Object.hasOwn(workflow.settings, 'errorWorkflow'), false);
  assert.equal(workflow.nodes[1].parameters.options.response.response.neverError, false);
  assert.deepEqual(JSON.parse(workflow.nodes[1].parameters.jsonBody).args, {});
  assert.deepEqual(Object.keys(JSON.parse(workflow.nodes[1].parameters.jsonBody)).sort(), [
    'args',
    'operation',
    'requestId',
    'version',
  ]);
  assert.deepEqual(workflow.connections, {
    [workflow.nodes[0].name]: { main: [[{ node: workflow.nodes[1].name, type: 'main', index: 0 }]] },
  });
  assert.equal(JSON.stringify(workflow).includes('apify/'), false);
  assert.throws(() => buildFoundationNativeDomainProbe({ runtimeAudience: packet.audience, settings }));
  assert.throws(() =>
    buildFoundationNativeDomainProbe({
      runtimeAudience,
      settings: { ...settings, saveManualExecutions: false },
    }),
  );
});
test('actual native spread preserves domain NodeApiError fields without nonenumerable cause', () => {
  const f = fixture();
  const proof = projectFoundationNativeDomainDenial({ ...f, runtimeAudience });
  assert.equal(proof.restrictionCode, 'native_credential_domain_blocked');
  assert.equal(proof.httpRequestIssued, false);
  assert.equal(proof.credentialId, 'EmrM03Machine19');
  assert.equal(Object.hasOwn(proof, 'message'), false);
  assert.equal(Object.hasOwn(proof, 'cause'), false);
  const lineage = fixture();
  lineage.resultData.runData[lineage.body.nodes[0].name][0].data.main[0][0].pairedItem = { item: 0 };
  assert.equal(projectFoundationNativeDomainDenial({ ...lineage, runtimeAudience }).httpRequestIssued, false);
});
test('HTTP403, generic/network errors, unbound target, response data, and unrelated native work cannot prove domain denial', () => {
  for (const mutate of [
    (f) => {
      f.resultData.error.node.id = 'unrelated';
    },
    (f) => {
      f.resultData.error.httpCode = '403';
    },
    (f) => {
      f.resultData.runData[f.body.nodes[1].name][0].error.statusCode = 403;
    },
    (f) => {
      f.resultData.error.message = 'Forbidden';
    },
    (f) => {
      f.resultData.runData[f.body.nodes[1].name][0].data = { main: [[{ json: { statusCode: 403 } }]] };
    },
    (f) => {
      f.body.nodes[1].parameters.url = runtimeAudience + '/api/internal/n8n/foundation';
    },
    (f) => {
      f.body.nodes[1].onError = 'continueRegularOutput';
    },
    (f) => {
      f.body.settings.errorWorkflow = 'owned-WF90-reference';
    },
    (f) => {
      f.resultData.runData.Extra = [{}];
    },
    (f) => {
      f.resultData.runData[f.body.nodes[1].name].push({});
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(
      () => projectFoundationNativeDomainDenial({ ...f, runtimeAudience }),
      /FOUNDATION_NATIVE_DOMAIN_PROBE_BLOCKED/,
    );
  }
});
