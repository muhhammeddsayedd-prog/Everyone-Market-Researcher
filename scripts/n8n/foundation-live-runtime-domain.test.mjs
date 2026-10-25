import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFixture } from './foundation-native-controller-fixtures.mjs';
import {
  buildFoundationNativeDomainProbe,
  foundationNativeDomainProbe,
} from './foundation-live-domain-probe.mjs';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { createFoundationNativeCleanup } from './foundation-native-cleanup.mjs';

function domainFixture({ httpStatus = false, wrongDomain = false, nullPins = false } = {}) {
  const audience = 'https://everyone-market-researcher-synthetic-domain-proof.vercel.app';
  let receipt;
  const f = baseFixture({
    beforeCreate(c) {
      const graph = buildFoundationNativeDomainProbe({
        runtimeAudience: audience,
        settings: {
          saveManualExecutions: true,
          saveDataSuccessExecution: 'none',
          saveDataErrorExecution: 'none',
          saveExecutionProgress: false,
          availableInMCP: true,
        },
      });
      const body = graph.workflow;
      c.save('WF-99', body.nodes);
      const bound = c.bound.get('WF-99');
      Object.assign(bound, { body, bodyHash: runtimeGraphHash(body), runtimeAudience: audience });
      c.bodies.set('WF-99', body);
      Object.assign(c.workflows.get(c.idFor('WF-99')), structuredClone(body));
      const message = `Domain not allowed: This credential is restricted from accessing ${new URL(foundationNativeDomainProbe.targetAudience).host}. Only the following domains are allowed: ${new URL(wrongDomain ? 'https://different.vercel.app' : audience).host}`;
      const error = {
        name: 'NodeApiError',
        message,
        httpCode: httpStatus ? '403' : null,
        node: structuredClone(body.nodes[1]),
        context: {
          itemIndex: 0,
          request: { method: 'POST', uri: body.nodes[1].parameters.url, allowedDomains: '**hidden**' },
        },
        ...(httpStatus ? { statusCode: 403 } : {}),
      };
      c.add('801', 'WF-99', 'manual', 'error', {
        resultData: {
          error,
          runData: {
            [body.nodes[0].name]: [{ data: { main: [[{ json: {} }]] } }],
            [body.nodes[1].name]: [{ error }],
          },
        },
      });
      if (nullPins) {
        c.executions.get('801').full.data.resultData.pinData = null;
        delete c.executions.get('801').full.workflowData.versionId;
      }
      receipt = {
        status: 'case_draft_verified',
        caseId: 'control.machine_domain',
        workflowId: c.idFor('WF-99'),
        versionId: bound.versionId,
      };
      c.ports.caseReceiptValidator = (r) => {
        if (r !== receipt) throw Error('SYNTHETIC_RECEIPT');
        return r;
      };
      c.ports.port.details = async () => ({
        id: c.idFor('WF-99'),
        versionId: bound.versionId,
        canExecute: true,
        scopes: ['workflow:execute'],
      });
      c.ports.port.start = async () => ({ status: 'started', executionId: '801' });
    },
  });
  return {
    ...f,
    input: {
      caseId: 'control.machine_domain',
      workflowKey: 'WF-99',
      versionId: receipt.versionId,
      caseReceipt: receipt,
    },
  };
}

test('fixed one-native domain control requires genuine producer-specific pre-HTTP denial and actual cleanup proof', async () => {
  const f = domainFixture();
  const r = await f.controller.runCase(f.input);
  assert.equal(r.state, 'native_settled');
  assert.deepEqual(r.executionIds, ['801']);
  assert.equal(f.controller.snapshot().nativeExecutions, 1);
  const receipt = f.controller.caseReceipts(r.caseId)[0];
  assert.equal(receipt.nativeDomainDenial.httpRequestIssued, false);
  assert.equal(receipt.nativeDomainDenial.restrictionCode, 'native_credential_domain_blocked');
  const cleanup = createFoundationNativeCleanup({
    reader: f.reader,
    transport: f.transport,
    admitControlAttempt: (args) => f.budget.admit(args),
    journal: f.journal,
    now: () => Date.parse('2026-10-19T12:00:01Z'),
    deadlineAt: Date.parse('2026-10-19T13:00:01Z'),
  });
  const proof = await cleanup.cleanup({ receipt, closure: r.closure });
  assert.equal(proof.state, 'native_record_deleted');
  assert.equal(f.controller.recordCleanup(proof).cleanupVerified, true);
  await assert.rejects(f.controller.runCase(f.input));
});

test('HTTP403 or a different allowed-domain producer cannot open the domain acceptance gate', async () => {
  for (const options of [{ httpStatus: true }, { wrongDomain: true }]) {
    const f = domainFixture(options);
    const r = await f.controller.runCase(f.input);
    assert.equal(r.state, 'native_unresolved');
    assert.equal(f.controller.caseClosure(r.caseId), null);
    assert.equal(
      f.calls.some((c) => c.method === 'DELETE'),
      false,
    );
  }
});

test('native nullable-pin domain control retains exact denial, settlement and cleanup requirements', async () => {
  const f = domainFixture({ nullPins: true });
  const r = await f.controller.runCase(f.input);
  assert.equal(r.state, 'native_settled');
  const receipt = f.controller.caseReceipts(r.caseId)[0];
  assert.equal(receipt.nativeDomainDenial.httpRequestIssued, false);
  assert.equal(receipt.nativeDomainDenial.actorStarts, 0);
  const cleanup = createFoundationNativeCleanup({
    reader: f.reader,
    transport: f.transport,
    admitControlAttempt: (args) => f.budget.admit(args),
    journal: f.journal,
    now: () => Date.parse('2026-10-19T12:00:01Z'),
    deadlineAt: Date.parse('2026-10-19T13:00:01Z'),
  });
  const proof = await cleanup.cleanup({ receipt, closure: r.closure });
  assert.equal(proof.state, 'native_record_deleted');
  assert.equal(f.controller.recordCleanup(proof).cleanupVerified, true);
  for (const options of [
    { nullPins: true, httpStatus: true },
    { nullPins: true, wrongDomain: true },
  ]) {
    const denied = domainFixture(options),
      result = await denied.controller.runCase(denied.input);
    assert.equal(result.state, 'native_unresolved');
    assert.equal(denied.controller.caseClosure(result.caseId), null);
    assert.equal(
      denied.calls.some((call) => call.method === 'DELETE'),
      false,
    );
  }
});
