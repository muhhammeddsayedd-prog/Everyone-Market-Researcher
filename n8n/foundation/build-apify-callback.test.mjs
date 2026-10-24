import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';

// Synthetic unit references only; no saved bindings or network access.
export function syntheticCallbackBindings() {
  return {
    runtimeVersion: '2.43.5',
    environment: 'dev',
    instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
    projectId: 'pHvQjDmjxVZ3KQLT',
    workflowRefs: Object.fromEntries(
      ['WF-90', 'WF-19', 'SUB-FINISH'].map((key) => [
        key,
        { id: `Synthetic${key.replaceAll('-', '')}`, name: foundationWorkflowNames[key] },
      ]),
    ),
    tagRefs: Object.fromEntries(
      ['env:dev', 'layer:ops'].map((name, i) => [name, { id: `SyntheticTag${i}`, name }]),
    ),
    credentials: {
      postgres: {
        id: 'SyntheticPostgres',
        name: 'Supabase Postgres · n8n_writer · dev',
        type: 'postgres',
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
      },
      apify: {
        id: 'SyntheticApify',
        name: 'Synthetic existing native Apify',
        type: 'apifyApi',
        environment: 'dev',
      },
    },
  };
}

export function runCallbackCode(node, rows, named = {}, extra = {}) {
  return JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${node.parameters.jsCode}\n})()`,
        {
          $input: { all: () => rows },
          $: (name) => ({ first: () => ({ json: named[name] }) }),
          ...extra,
        },
        { timeout: 1000 },
      ),
    ),
  );
}

test('callback requires actual dev references and exposes incomplete native acceptance explicitly', async () => {
  const { buildApifyCallback } = await import('./build-apify-callback.mjs');
  assert.throws(() => buildApifyCallback(), /EMR_N8N_BINDINGS_INVALID/);
  assert.throws(
    () => buildApifyCallback({ ...syntheticCallbackBindings(), workflowRefs: {} }),
    /EMR_N8N_BINDING_MISSING/,
  );
  const result = buildApifyCallback(syntheticCallbackBindings());
  assert.equal(result.workflow.active, false);
  assert.equal(result.workflow.settings.timezone, 'Africa/Cairo');
  assert.equal(result.workflow.settings.executionTimeout, 900);
  assert.equal(result.hostedAcceptance, false);
  assert.equal(result.runnableWorkflow, false);
  assert.ok(result.remainingGates.includes('durable unknown-callback rejection audit'));
  assert.ok(result.remainingGates.includes('transport response-byte limit before any live dataset request'));
  assert.equal(result.requestLimit.postParseDatasetBytes, 1048576);
  assert.equal(result.requestLimit.transportDatasetBytesVerified, false);
  assert.ok(result.sourceOnlyNodeTypes.includes('wait'));
});

test('callback has bounded authenticated terminal GETs and no paid launch or primitive persistence', async () => {
  const { buildApifyCallback } = await import('./build-apify-callback.mjs');
  const result = buildApifyCallback(syntheticCallbackBindings());
  const nodes = result.workflow.nodes;
  const http = nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.ok(http.length >= 2 && http.length <= 3);
  assert.ok(http.every((n) => n.parameters.method === 'GET' && n.retryOnFail === false));
  assert.ok(
    http.every(
      (n) =>
        n.parameters.authentication === 'predefinedCredentialType' &&
        n.parameters.nodeCredentialType === 'apifyApi',
    ),
  );
  assert.ok(
    http.every(
      (n) => n.parameters.options.timeout === 60000 && n.parameters.options.allowUnauthorizedCerts === false,
    ),
  );
  assert.ok(http.every((n) => n.parameters.options.redirect.redirect.followRedirects === false));
  const wait = nodes.find((n) => n.type === 'n8n-nodes-base.wait');
  assert.equal(wait.typeVersion, 1.1);
  assert.deepEqual(wait.parameters, { resume: 'timeInterval', amount: 10, unit: 'seconds' });
  const sql = nodes
    .filter((n) => n.type === 'n8n-nodes-base.postgres')
    .map((n) => n.parameters.query)
    .join('\n');
  assert.match(sql, /ops\.process_apify_run\(\$1,\$2,\$3,\$4,\$5::jsonb\)/);
  assert.doesNotMatch(
    sql,
    /ingest\.upsert_raw_items|ops\.report_account_result|ops\.complete_apify_run|ops\.log_cost|ops\.start_run/,
  );
});

test('webhook source strips untrusted callback fields and recovery source accepts only original IDs', async () => {
  const { buildApifyCallback } = await import('./build-apify-callback.mjs');
  const graph = buildApifyCallback(syntheticCallbackBindings()).workflow;
  const extract = graph.nodes.find((n) => n.name === 'Validate callback source');
  const result = runCallbackCode(extract, [
    {
      json: {
        body: {
          eventType: 'ACTOR.RUN.SUCCEEDED',
          resource: { id: 'SyntheticOriginalRun' },
          emr: { run_id: 'untrusted' },
          usageTotalUsd: 0,
        },
      },
    },
  ]);
  assert.deepEqual(result, [
    {
      json: { apify_run_id: 'SyntheticOriginalRun', transport: 'webhook', params: ['SyntheticOriginalRun'] },
    },
  ]);
  assert.throws(
    () =>
      runCallbackCode(extract, [
        { json: { apify_run_id: 'SyntheticOriginalRun', env: 'prod', transport: 'recovery' } },
      ]),
    /EMR_APIFY_NOTIFICATION_INVALID/,
  );
});

const parentId = '10000000-0000-4000-8000-000000000001';
const accountId = '10000000-0000-4000-8000-000000000002';
const itemId = '10000000-0000-4000-8000-000000000003';
const registryFixture = () => ({
  apify_run_id: 'SyntheticOriginalRun',
  actor_id: 'apify/website-content-crawler',
  run_id: parentId,
  account_ids: [accountId],
  purpose: 'daily',
  processed_at: null,
});
const wire = (change = {}) => ({
  data: {
    id: 'SyntheticOriginalRun',
    actId: 'aYG0l9s7dbB7j3gbS',
    status: 'SUCCEEDED',
    defaultDatasetId: 'SyntheticDataset',
    usageTotalUsd: 0.0045,
    finishedAt: '2026-10-18T03:00:00Z',
    ...change,
  },
});
const receiptFixture = () => ({
  updated: true,
  finished_now: true,
  apify_run_id: 'SyntheticOriginalRun',
  run_id: parentId,
  account_ids: [accountId],
  status: 'SUCCEEDED',
  dataset_id: 'SyntheticDataset',
  cost_usd: 0.0045,
  groups_sha256: 'a'.repeat(64),
  normalizer_version: 'smoke_website_stub.v1',
  cost_keys: [`apify:SyntheticOriginalRun:${accountId}`],
  items_seen: 1,
  items_new: 1,
  new_item_ids: [itemId],
  accounts_ok: 1,
  accounts_failed: 0,
  run_summary: {
    run_id: parentId,
    status: 'success',
    accounts_total: 1,
    accounts_ok: 1,
    accounts_failed: 0,
    items_seen: 1,
    items_new: 1,
    cost_usd: 0.0045,
  },
});
const clock = (now) => ({
  Date: class extends Date {
    static now() {
      return now;
    }
  },
});
async function harness() {
  const { buildApifyCallback } = await import('./build-apify-callback.mjs');
  const workflow = buildApifyCallback(syntheticCallbackBindings()).workflow;
  const named = {};
  const run = (name, rows, extra = {}) => {
    const result = runCallbackCode(
      workflow.nodes.find((n) => n.name === name),
      rows,
      named,
      extra,
    );
    named[name] = result[0]?.json;
    return result;
  };
  run('Validate callback source', [
    { json: { apify_run_id: 'SyntheticOriginalRun', env: 'dev', transport: 'recovery' } },
  ]);
  return { workflow, named, run };
}
async function settledHarness(change = {}) {
  const h = await harness();
  h.run('Bind registered context', [{ json: { registered: registryFixture() } }]);
  h.run('Project first terminal', [{ json: { statusCode: 200, body: wire(change) } }], clock(1000));
  h.run('Verify stable terminal', [{ json: { statusCode: 200, body: wire(change) } }], clock(11000));
  return h;
}

test('unknown callbacks hit the missing durable-audit gate and processed replays return saved false flags', async () => {
  const h = await harness();
  assert.throws(
    () => h.run('Bind registered context', [{ json: { registered: null } }]),
    /^Error: EMR_APIFY_UNKNOWN_CALLBACK_AUDIT_UNAVAILABLE$/,
  );
  h.run('Bind registered context', [
    {
      json: {
        registered: {
          ...registryFixture(),
          processed_at: '2026-10-18T03:01:00Z',
          status: 'SUCCEEDED',
          dataset_id: 'SyntheticDataset',
          usage_usd: 0.0045,
          processing_result: receiptFixture(),
        },
      },
    },
  ]);
  assert.equal(h.named['Bind registered context'].replayed, true);
  const replay = h.run('Return saved receipt', [{ json: h.named['Bind registered context'] }])[0].json;
  assert.equal(replay.completion.updated, false);
  assert.equal(replay.completion.finished_now, false);
  assert.equal(replay.payloadEqualityVerified, false);
  const returned = h.run('Return recovery receipt', [{ json: replay }])[0].json;
  assert.deepEqual(returned, { completion: replay.completion, payloadEqualityVerified: false });
  assert.equal(Object.hasOwn(returned.completion, 'payloadEqualityVerified'), false);
  assert.deepEqual(
    h.workflow.connections['Return saved receipt'].main[0].map((n) => n.node),
    ['Webhook response?'],
  );
});

test('terminal identity, normalized timeout and delayed unchanged cost are enforced by actual embedded runtime', async () => {
  const h = await harness();
  h.run('Bind registered context', [{ json: { registered: registryFixture() } }]);
  assert.throws(
    () =>
      h.run(
        'Project first terminal',
        [{ json: { statusCode: 200, body: wire({ id: 'OtherRun' }) } }],
        clock(1000),
      ),
    /EMR_APIFY_TRUSTED_RUN_INVALID/,
  );
  h.run('Project first terminal', [{ json: { statusCode: 200, body: wire() } }], clock(1000));
  assert.throws(
    () => h.run('Verify stable terminal', [{ json: { statusCode: 200, body: wire() } }], clock(10999)),
    /EMR_APIFY_COST_NOT_SETTLED/,
  );
  assert.throws(
    () =>
      h.run(
        'Verify stable terminal',
        [{ json: { statusCode: 200, body: wire({ usageTotalUsd: 0.005 }) } }],
        clock(11000),
      ),
    /EMR_APIFY_COST_NOT_SETTLED/,
  );
  assert.throws(
    () => h.run('Verify stable terminal', [{ json: { statusCode: 200, body: wire() } }], clock(181001)),
    /EMR_APIFY_COST_NOT_SETTLED/,
  );
  const failed = await settledHarness({ status: 'TIMED-OUT', defaultDatasetId: null });
  assert.equal(failed.named['Verify stable terminal'].terminal.status, 'TIMED_OUT');
  const group = failed.run('Prepare failed actor group', [
    { json: failed.named['Verify stable terminal'] },
  ])[0].json;
  assert.equal(group.payload.p_status, 'TIMED_OUT');
  assert.deepEqual(group.payload.p_groups[0].items, []);
});

test('success dataset access is blocked until an explicit future live privacy review', async () => {
  const h = await settledHarness();
  assert.throws(
    () => h.run('Dataset live release gate', [{ json: h.named['Verify stable terminal'] }]),
    /^Error: EMR_APIFY_DATASET_LIVE_REVIEW_REQUIRED$/,
  );
  const dataset = h.workflow.nodes.find((n) => n.name === 'Read bounded public dataset');
  assert.equal(dataset.retryOnFail, false);
  assert.match(h.named['Verify stable terminal'].dataset_url, /limit=2/);
  assert.match(
    h.named['Verify stable terminal'].dataset_url,
    /fields=url%2Cmarkdown%2Cmetadata%2Ccrawl%2Cerror$/,
  );
  assert.doesNotMatch(h.named['Verify stable terminal'].dataset_url, /metadata[.]title|token=|clean=true/);
});

test('exact public source composition works without URL globals and drops unknown nested contexts', async () => {
  const h = await settledHarness();
  const row = {
    url: 'https://everyone.film/about-everyone',
    markdown: 'Synthetic public text',
    metadata: { title: 'Synthetic title', request: { synthetic: 'SYNTHETIC_PRIVATE_MARKER' } },
    crawl: {
      loadedUrl: 'https://everyone.film/about-everyone',
      referrerUrl: 'https://everyone.film/',
      context: 'SYNTHETIC_PRIVATE_MARKER',
    },
  };
  const result = h.run('Normalize exact public page', [{ json: { statusCode: 200, body: [row] } }], {
    URL: undefined,
    require: (name) => {
      assert.equal(name, 'crypto');
      return { createHash };
    },
  })[0].json;
  assert.equal(result.params.length, 5);
  assert.equal(result.payload.p_groups[0].account_id, accountId);
  assert.equal(result.payload.p_groups[0].normalizer_version, 'smoke_website_stub.v1');
  assert.equal(result.payload.p_groups[0].items[0].external_id, 'e4d69e3fb0d821183258d75248f9df24');
  assert.deepEqual(Object.keys(result.payload.p_groups[0].items[0]).sort(), [
    'actor',
    'caption',
    'external_id',
    'item_type',
    'metrics',
    'payload',
    'platform',
    'published_at',
    'title',
    'url',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE_MARKER|request/);
  for (const body of [
    [],
    [row, row],
    [{ ...row, url: 'https://other.film/' }],
    [{ ...row, error: 'Synthetic failure' }],
    [{ ...row, markdown: 'x'.repeat(1048576) }],
  ]) {
    assert.throws(
      () =>
        h.run('Normalize exact public page', [{ json: { statusCode: 200, body } }], {
          require: () => ({ createHash }),
        }),
      /^Error: EMR_APIFY_DATASET_INVALID$/,
    );
  }
});

test('atomic response requires durable matching readback, and never automatically retries or refinalizes', async () => {
  const h = await settledHarness();
  const row = {
    url: 'https://everyone.film/about-everyone',
    markdown: 'Synthetic public text',
    metadata: { title: 'Synthetic title' },
  };
  h.run('Normalize exact public page', [{ json: { statusCode: 200, body: [row] } }], {
    require: () => ({ createHash }),
  });
  h.run('Prepare atomic request', [{ json: h.named['Normalize exact public page'] }]);
  const ambiguous = h.run('Validate atomic response', [{ json: { message: 'Synthetic lost response' } }])[0]
    .json;
  assert.equal(ambiguous.observedReceipt, null);
  assert.equal(ambiguous.responseClass, 'ambiguous');
  assert.deepEqual(ambiguous.params, ['SyntheticOriginalRun', parentId]);
  assert.doesNotMatch(JSON.stringify(ambiguous), /Synthetic lost response/);
  for (const rows of [[], [{ json: { receipt: { message: 'Synthetic malformed receipt' } } }]]) {
    const malformed = h.run('Validate atomic response', rows)[0].json;
    assert.equal(malformed.observedReceipt, null);
    assert.equal(malformed.responseClass, 'ambiguous');
    assert.deepEqual(malformed.params, ['SyntheticOriginalRun', parentId]);
    assert.doesNotMatch(JSON.stringify(malformed), /Synthetic malformed receipt/);
  }
  const completed = {
    ...registryFixture(),
    processed_at: '2026-10-18T03:01:00Z',
    status: 'SUCCEEDED',
    dataset_id: 'SyntheticDataset',
    usage_usd: 0.0045,
    processing_result: receiptFixture(),
  };
  const recovered = h.run('Confirm durable completion', [{ json: { registered: completed, pending: 0 } }])[0]
    .json;
  assert.equal(recovered.completion.updated, false);
  assert.equal(recovered.completion.finished_now, false);
  assert.equal(recovered.payloadEqualityVerified, false);
  const recoveredResponse = h.run('Return first completion', [{ json: receiptFixture().run_summary }])[0]
    .json;
  assert.equal(recoveredResponse.payloadEqualityVerified, false);
  assert.equal(recoveredResponse.completion.finished_now, false);
  const recoveredReturn = h.run('Return recovery receipt', [{ json: recoveredResponse }])[0].json;
  assert.equal(recoveredReturn.payloadEqualityVerified, false);
  assert.equal(recoveredReturn.completion.finished_now, false);
  assert.throws(
    () => h.run('Confirm durable completion', [{ json: { registered: registryFixture(), pending: 1 } }]),
    /EMR_APIFY_ATOMIC_UNPROCESSED_REQUIRES_MANUAL_SAME_ARGS/,
  );
  h.run('Validate atomic response', [{ json: { receipt: receiptFixture() } }]);
  assert.throws(
    () => h.run('Confirm durable completion', [{ json: { registered: registryFixture(), pending: 0 } }]),
    /EMR_APIFY_RECEIPT_NOT_DURABLE/,
  );
  assert.throws(
    () => h.run('Confirm durable completion', [{ json: { registered: completed, pending: 1 } }]),
    /EMR_APIFY_COMPLETION_READBACK_INVALID/,
  );
  const confirmed = h.run('Confirm durable completion', [{ json: { registered: completed, pending: 0 } }])[0]
    .json;
  assert.equal(confirmed.completion.finished_now, true);
  assert.equal(confirmed.payloadEqualityVerified, true);
  const response = h.run('Return first completion', [{ json: receiptFixture().run_summary }])[0].json;
  assert.equal(response.completion.run_id, parentId);
  assert.equal(response.payloadEqualityVerified, true);
  const returned = h.run('Return recovery receipt', [{ json: response }])[0].json;
  assert.equal(returned.payloadEqualityVerified, true);
  assert.equal(Object.hasOwn(returned.completion, 'payloadEqualityVerified'), false);
  assert.equal(h.workflow.nodes.find((n) => n.name === 'Persist atomic callback').retryOnFail, false);
  assert.ok(!h.workflow.nodes.some((n) => n.parameters.query?.includes('ops.finish_run(')));
});
