import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildNativeM06Callback, buildUnboundNativeM06Callback } from './build-native-m06-callback.mjs';
const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const transport = {
  audience: 'https://everyone-market-researcher-local-stories.vercel.app',
  credential: { id: 'LocalStoriesMachine', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const media = {
  environment: 'dev',
  queue: 'stories',
  workflowId: 'LocalStoryMedia31',
  audience: transport.audience,
  batchSize: 5,
};
const providerId = 'LocalStoryRun',
  run = '63000000-0000-4000-8000-000000000001',
  launch = '63000000-0000-4000-8000-000000000002',
  account = '63000000-0000-4000-8000-000000000003';
const incoming = {
  body: {
    eventType: 'ACTOR.RUN.SUCCEEDED',
    resource: { id: providerId, usageTotalUsd: 999, untrusted: 'not source authority' },
  },
};
const admission = (state = 'pending', replayed = false) => ({
  scope: 'm06',
  accepted: true,
  durable: true,
  apify_run_id: providerId,
  run_id: run,
  launch_id: launch,
  state,
  replayed,
});
const completion = (updated = true) => ({
  state: 'completed',
  updated,
  groups: [{ account_id: account, status: 'success', items_seen: 12, items_new: 12, error: null }],
  media_dispatch: updated ? { queue: 'stories', items_new: 12 } : null,
});
const receipt = (claimed, id) => ({
  version: 1,
  execution_id: String(id),
  replayed: false,
  state: 'completed',
  claimed,
  processed: claimed,
  held: 0,
  stored: claimed,
  skipped: 0,
  expired: 0,
  retryable: 0,
  reconciliation_required: 0,
  bytes: claimed * 100,
  infrastructure_cost_usd: null,
});
const graph = () => buildNativeM06Callback(bindings, transport, media);

// Focused execution of this assembled native graph, with HTTP/child execution
// mocked at platform boundaries. No provider, n8n or Storage request is made.
async function runGraph(d, options = {}) {
  const seen = new Map(),
    events = options.events ?? [],
    outputs = [],
    calls = [];
  let name = options.recovery ? 'When called' : 'Apify stories callback',
    value = options.recovery ? { apify_run_id: providerId, env: 'dev', transport: 'recovery' } : incoming,
    children = 0,
    steps = 0;
  const expr = (s, current) =>
    typeof s === 'string' && s.startsWith('={{')
      ? runInNewContext('(' + s.slice(3, -2) + ')', { $json: current })
      : s;
  while (name) {
    assert.ok(++steps < 100, 'finite native graph');
    const n = d.workflow.nodes.find((n) => n.name === name);
    assert.ok(n, name);
    let branch = 0;
    if (n.type.endsWith('.code')) {
      const context = {
        $execution: { id: '63001' },
        $input: { all: () => [{ json: value }] },
        $: (ref) => ({ item: { json: seen.get(ref) }, first: () => ({ json: seen.get(ref) }) }),
      };
      const rows = runInNewContext('(function(){' + n.parameters.jsCode + '})()', context, { timeout: 1000 });
      assert.equal(rows.length, 1);
      value = rows[0].json;
    } else if (n.type.endsWith('.if'))
      branch = expr(n.parameters.conditions.conditions[0].leftValue, value) ? 0 : 1;
    else if (n.type.endsWith('.httpRequest')) {
      const request = value.request;
      calls.push(request.operation);
      events.push(request.operation);
      if (request.operation === 'callback.admit') {
        if (options.admitError)
          value = { statusCode: options.admitError, body: { error: { code: 'controlled' } } };
        else
          value = {
            statusCode: 200,
            body: {
              version: 1,
              requestId: request.requestId,
              operation: request.operation,
              replayed: !!options.replay,
              result:
                options.badAdmission ?? admission(options.replay ? 'completed' : 'pending', !!options.replay),
            },
          };
      } else {
        assert.equal(request.operation, 'callback.process');
        if (options.processError) value = { statusCode: 503, body: { error: { code: 'outcome_unknown' } } };
        else
          value = {
            statusCode: 200,
            body: {
              version: 1,
              requestId: request.requestId,
              operation: request.operation,
              replayed: !!options.replay,
              result: options.complete ?? completion(!options.replay),
            },
          };
      }
    } else if (n.type.endsWith('.respondToWebhook')) {
      const output = {
        status: expr(n.parameters.options.responseCode, value),
        body: expr(n.parameters.responseBody, value),
      };
      outputs.push(output);
      events.push('respond:' + output.status);
      // Pinned RespondToWebhook1.5 keeps its original input on output0.
    } else if (n.type.endsWith('.executeWorkflow')) {
      assert.equal(n.parameters.workflowId.value, media.workflowId);
      assert.equal(n.parameters.mode, 'once');
      assert.equal(n.parameters.options.waitForSubWorkflow, true);
      assert.deepEqual(n.parameters.workflowInputs.value, {});
      assert.equal(n.retryOnFail, false);
      events.push('media');
      children++;
      value = options.mediaError
        ? { ...receipt(5, 63010 + children), state: 'reconciliation_required', held: 1 }
        : receipt(children < 3 ? 5 : 2, 63010 + children);
    }
    seen.set(name, value);
    const next = d.workflow.connections[name]?.main?.[branch] ?? [];
    assert.ok(next.length <= 1);
    name = next[0]?.node;
  }
  return { value, outputs, events, calls, children, seen };
}
test('assembled callback ACKs durable admission before provider processing or finite story media delivery', async () => {
  const d = graph(),
    r = await runGraph(d);
  assert.deepEqual(r.events, [
    'callback.admit',
    'respond:200',
    'callback.process',
    'media',
    'media',
    'media',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(r.outputs)), [
    { status: 200, body: { ok: true, accepted: true, state: 'pending', replayed: false } },
  ]);
  assert.equal(r.value.media.batches, 3);
  assert.equal(r.children, 3);
  assert.equal(r.value.apify_run_id, providerId);
  const process = d.workflow.nodes.find((n) => n.name === 'Process authoritative story callback');
  assert.equal(process.parameters.options.timeout, 60000);
  const admit = d.workflow.nodes.find((n) => n.name === 'Admit owned story callback');
  assert.equal(admit.parameters.options.timeout, 8000);
  assert.equal(admit.retryOnFail, false);
  assert.equal(d.workflow.active, false);
  assert.equal(d.workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(d.workflow.settings.saveDataErrorExecution, 'none');
  for (const n of d.workflow.nodes.filter((n) => n.type.endsWith('.httpRequest'))) {
    assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(n.credentials.httpCustomAuth.id, transport.credential.id);
  }
});
test('completed replay uses strict completion-body extraction and never dispatches media again', async () => {
  const r = await runGraph(graph(), { replay: true });
  assert.deepEqual(r.events, ['callback.admit', 'respond:200', 'callback.process']);
  assert.equal(r.children, 0);
  assert.equal(r.value.replayed, true);
  const recovered = await runGraph(graph(), { recovery: true, replay: true });
  assert.deepEqual(recovered.outputs, []);
  assert.equal(recovered.value.replayed, true);
});
test('unknown IDs and admission transport failures cannot receive a success ACK or process source data', async () => {
  for (const status of [403, 503]) {
    const r = await runGraph(graph(), { admitError: status });
    assert.equal(r.outputs[0].status, status);
    assert.deepEqual(r.calls, ['callback.admit']);
    assert.equal(r.children, 0);
  }
  for (const patch of [
    { durable: false },
    { apify_run_id: 'OtherRun' },
    { run_id: 'not-uuid' },
    { state: 'finished' },
    { replayed: true },
  ])
    await assert.rejects(
      runGraph(graph(), { badAdmission: { ...admission(), ...patch } }),
      /ADMISSION_INVALID/,
    );
});
test('uncertain processing or media stops after the safe ACK and leaves durable reconciliation sources', async () => {
  for (const fault of [{ processError: true }, { mediaError: true }]) {
    const events = [];
    await assert.rejects(runGraph(graph(), { ...fault, events }), /RECONCILIATION_REQUIRED/);
    assert.deepEqual(events.slice(0, 3), ['callback.admit', 'respond:200', 'callback.process']);
    assert.equal(events.filter((e) => e === 'callback.process').length, 1);
  }
  const rejectedWake = await runGraph(graph(), {
    complete: {
      ...completion(),
      groups: [
        {
          account_id: account,
          status: 'failed',
          items_seen: 0,
          items_new: 0,
          error: 'stories_private_or_login',
        },
      ],
      media_dispatch: null,
    },
  });
  assert.deepEqual(rejectedWake.events, ['callback.admit', 'respond:200', 'callback.process']);
  assert.equal(rejectedWake.children, 0);
});
test('the declared output and complete child/shutdown envelope must fit before I/O', async () => {
  assert.throws(
    () => buildNativeM06Callback(bindings, transport, media, { maxOutputItems: 36, executionTimeout: 1800 }),
    /RUNTIME_ENVELOPE_INVALID/,
  );
  const smaller = buildNativeM06Callback(bindings, transport, media, {
    maxOutputItems: 12,
    executionTimeout: 1800,
  });
  assert.equal(smaller.workflow.settings.executionTimeout, 1800);
  assert.equal(graph().workflow.settings.executionTimeout, 2700);
  await assert.rejects(
    runGraph(smaller, {
      complete: {
        ...completion(),
        groups: [{ account_id: account, status: 'success', items_new: 13 }],
        media_dispatch: { queue: 'stories', items_new: 13 },
      },
    }),
    /RECONCILIATION_REQUIRED/,
  );
  await assert.rejects(
    runGraph(graph(), { complete: { ...completion(), media_dispatch: { queue: 'stories', items_new: 1 } } }),
    /RECONCILIATION_REQUIRED/,
  );
});
test('unbound maintained export fails before any HTTP while historical shared definitions remain separate', async () => {
  const d = buildUnboundNativeM06Callback(bindings);
  await assert.rejects(runGraph(d), /BINDING_REQUIRED/);
  assert.equal(d.bindingManifest.ready, false);
  const exported = JSON.parse(
    readFileSync(new URL('../workflows/WF-19-M06-stories.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(exported, d);
  assert.equal(
    d.workflow.nodes.find((n) => n.type.endsWith('.webhook')).parameters.responseMode,
    'responseNode',
  );
  assert.equal(
    d.workflow.nodes.filter((n) => n.type.endsWith('.respondToWebhook')).every((n) => n.typeVersion === 1.5),
    true,
  );
});
