import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  buildNativeM06Upkeep,
  buildUnboundNativeM06Upkeep,
  buildNativeM06Health,
  buildUnboundNativeM06Health,
  initializeM06Upkeep,
  advanceM06Upkeep,
  initializeM06UpkeepHealth,
  verifyM06UpkeepHealth,
} from './build-native-m06-upkeep.mjs';

const b = JSON.parse(readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'));
const transport = {
  audience: 'https://everyone-market-researcher-upkeep-fixture.vercel.app',
  credential: { id: 'FixtureUpkeep', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const id = (n) => `64000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const target = (n = 1, platform = 'vimeo') => ({
  account_id: id(n),
  platform,
  since: '2026-08-01',
  metrics_since: '2026-10-01',
});
const accountResult = (patch = {}) => ({
  account_id: id(1),
  platform: 'vimeo',
  since: '2026-08-01',
  metrics_since: '2026-10-01',
  metrics_updated: 1,
  eligible: true,
  reason: null,
  removal: { removed: 1, restored: 0, skipped: null },
  ...patch,
});
const reply = (s, result, patch = {}) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: s.request.requestId,
    operation: s.request.operation,
    replayed: false,
    result,
  },
  ...patch,
});
const seeded = () => {
  const s = initializeM06Upkeep({ env: 'dev', platform: 'vimeo' }, '1000');
  return advanceM06Upkeep(s, reply(s, { targets: [target()], next_account_id: null }));
};
const code = (g, name, input, lookup = {}) =>
  runInNewContext(
    '(function(){' + g.nodes.find((n) => n.name === name).parameters.jsCode + '})()',
    {
      $input: { all: () => [{ json: input }] },
      $execution: { id: '1000' },
      $: (name) => ({ item: { json: lookup[name] } }),
    },
    { timeout: 1000 },
  );

test('native upkeep initializes an explicit dev platform and bounded target page without coverage input', () => {
  const s = initializeM06Upkeep({ env: 'dev', platform: 'instagram', after: id(20) }, '1000');
  assert.deepEqual(s.request.args, { platform: 'instagram', after: id(20), limit: 20 });
  assert.equal(s.request.operation, 'targets');
  for (const value of [
    { env: 'prod', platform: 'vimeo' },
    { env: 'dev', platform: 'instagram_stories' },
    { env: 'dev', platform: 'vimeo', complete: true },
    { env: 'dev', platform: 'vimeo', after: 'unsafe' },
  ])
    assert.throws(() => initializeM06Upkeep(value, '1000'), /INPUT_INVALID/);
});

test('target receipts are identity/date checked, serial, deduplicated, and never silently truncated', () => {
  const s = initializeM06Upkeep({ env: 'dev', platform: 'vimeo' }, '1000');
  const next = advanceM06Upkeep(s, reply(s, { targets: [target(), target(2)], next_account_id: null }));
  assert.equal(next.request.operation, 'account.process');
  assert.deepEqual(next.request.args, target());
  const advanced = advanceM06Upkeep(next, reply(next, accountResult()));
  assert.deepEqual(advanced.request.args, target(2));
  const end = advanceM06Upkeep(advanced, reply(advanced, accountResult({ account_id: id(2) })));
  assert.equal(end.action, 'done');
  assert.equal(end.result.processed, 2);
  for (const rows of [
    [target(), target()],
    [target(1, 'youtube')],
    [{ ...target(), since: '2026-02-30' }],
    Array.from({ length: 21 }, (_, n) => target(n + 1)),
  ]) {
    const fresh = initializeM06Upkeep({ env: 'dev', platform: 'vimeo' }, '1000');
    assert.throws(
      () => advanceM06Upkeep(fresh, reply(fresh, { targets: rows, next_account_id: null })),
      /TARGETS_INVALID/,
    );
  }
});

test('target continuation is surfaced after exactly20 processed accounts rather than launched recursively', () => {
  let s = initializeM06Upkeep({ env: 'dev', platform: 'vimeo' }, '1000');
  s = advanceM06Upkeep(
    s,
    reply(s, { targets: Array.from({ length: 20 }, (_, n) => target(n + 1)), next_account_id: id(20) }),
  );
  for (let n = 1; n <= 20; n++) s = advanceM06Upkeep(s, reply(s, accountResult({ account_id: id(n) })));
  assert.equal(s.action, 'done');
  assert.equal(s.result.next_account_id, id(20));
  assert.equal(s.result.processed, 20);
  assert.equal(s.sequence, 21);
});

test('uncertain mutation reconciles its original ID once and never emits another mutation', () => {
  let s = seeded();
  const original = s.request.requestId;
  s = advanceM06Upkeep(s, { error: { message: 'synthetic private transport detail' } });
  assert.equal(s.action, 'reconcile');
  assert.equal(s.request.operation, 'request.status');
  assert.deepEqual(s.request.args, { request_id: original });
  assert.ok(!JSON.stringify(s).includes('private transport detail'));
  s = advanceM06Upkeep(
    s,
    reply(s, { state: 'completed', operation: 'apply_observation', result: accountResult() }),
  );
  assert.equal(s.action, 'done');
  assert.equal(s.result.outcomes[0].verified_by, 'status');
  assert.equal(s.result.outcomes[0].request_id, original);
});

test('unknown, mismatched, malformed and failed status receipts stop without another write', () => {
  for (const result of [
    { state: 'missing', operation: null, result: null },
    { state: 'completed', operation: 'mark_removed', result: accountResult() },
    { state: 'completed', operation: 'apply_observation', result: accountResult({ account_id: id(2) }) },
    { state: 'completed', operation: 'apply_observation', result: accountResult({ since: '2026-07-31' }) },
  ]) {
    let s = seeded();
    s = advanceM06Upkeep(s, { statusCode: 503, body: {} });
    assert.throws(() => advanceM06Upkeep(s, reply(s, result)), /RECONCILIATION_REQUIRED/);
    assert.equal(s.request.operation, 'request.status');
  }
});

test('completed direct replay is accepted under its original request identity; changed account/window is reconciled', () => {
  let s = seeded();
  const original = s.request.requestId;
  const response = reply(s, accountResult());
  response.body.replayed = true;
  s = advanceM06Upkeep(s, response);
  assert.equal(s.result.outcomes[0].request_id, original);
  assert.equal(s.result.outcomes[0].verified_by, 'direct');
  for (const patch of [{ account_id: id(2) }, { metrics_since: '2026-09-30' }, { platform: 'youtube' }]) {
    let bad = seeded();
    bad = advanceM06Upkeep(bad, reply(bad, accountResult(patch)));
    assert.equal(bad.action, 'reconcile');
    assert.equal(bad.request.operation, 'request.status');
  }
});

test('failed or malformed target reads do not enter mutation/retry paths', () => {
  const s = initializeM06Upkeep({ env: 'dev', platform: 'vimeo' }, '1000');
  for (const response of [
    { statusCode: 503, body: {} },
    { error: 'redacted' },
    reply(s, { targets: [], next_account_id: id(1) }),
  ]) {
    assert.throws(() => advanceM06Upkeep(s, response), /TARGETS_INVALID/);
    assert.equal(s.request.operation, 'targets');
  }
});

test('partial listings can settle metrics while removal remains null; private receipt fields trigger reconciliation', () => {
  let s = seeded();
  s = advanceM06Upkeep(
    s,
    reply(s, accountResult({ eligible: false, reason: 'range_not_covered', removal: null })),
  );
  assert.equal(s.result.outcomes[0].metrics_updated, 1);
  assert.equal(s.result.outcomes[0].removal, null);
  let bad = seeded();
  bad = advanceM06Upkeep(bad, reply(bad, accountResult({ raw_error: 'private' })));
  assert.equal(bad.action, 'reconcile');
});

test('assembled native Code and HTTP mappings execute target-to-account-to-result without source assertions', () => {
  const g = buildNativeM06Upkeep(b, transport).workflow;
  let s = code(g, 'Initialize upkeep page', { env: 'dev', platform: 'vimeo' })[0].json;
  s = code(g, 'Advance upkeep receipt', reply(s, { targets: [target()], next_account_id: null }), {
    'Prepare upkeep HTTP': s,
  })[0].json;
  assert.equal(s.request.operation, 'account.process');
  s = code(g, 'Advance upkeep receipt', reply(s, accountResult()), { 'Prepare upkeep HTTP': s })[0].json;
  assert.equal(code(g, 'Return upkeep page', s)[0].json.processed, 1);
  const http = g.nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.parameters.jsonBody, '={{ $json.request }}');
  assert.equal(http.parameters.url, transport.audience + '/api/internal/m06/upkeep');
  assert.equal(http.parameters.options.timeout, 60000);
  assert.equal(http.parameters.options.allowUnauthorizedCerts, false);
  assert.equal(http.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(http.retryOnFail, false);
  assert.equal(http.onError, 'continueRegularOutput');
  assert.equal(http.credentials.httpCustomAuth.id, transport.credential.id);
});

test('inactive graphs require bindings before I/O and preserve historical guards and no-email boundary', () => {
  for (const [build, guard] of [
    [buildUnboundNativeM06Upkeep, 'Initialize upkeep page'],
    [buildUnboundNativeM06Health, 'Prepare maintained health read'],
  ]) {
    const spec = build(b),
      g = spec.workflow;
    assert.equal(g.active, false);
    assert.equal(g.settings.availableInMCP, false);
    assert.equal(g.settings.saveManualExecutions, false);
    assert.equal(g.settings.saveDataSuccessExecution, 'none');
    assert.equal(g.settings.saveDataErrorExecution, 'none');
    assert.equal(g.settings.saveExecutionProgress, false);
    assert.equal(g.settings.errorWorkflow, undefined);
    assert.ok(!g.nodes.some((n) => /schedule|email|postgres|executeWorkflow$/.test(n.type)));
    assert.throws(() => code(g, guard, {}), /BINDING_REQUIRED/);
  }
  for (const [path, spec] of [
    ['../workflows/WF-40-M06-upkeep.json', buildUnboundNativeM06Upkeep(b)],
    ['../workflows/WF-91-M06-health.json', buildUnboundNativeM06Health(b)],
  ])
    assert.deepEqual(JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')), spec);
});

const healthResult = () => ({
  health: { synthetic: true },
  projection: {
    version: 'm06',
    failing_accounts: 0,
    stale_accounts: 0,
    queue_depths: { ai_extract: 0, embed: 0, media: 267 },
    story_queue_depth: null,
    zero_item_streaks: 0,
    story_capture_gap: null,
    media_missing_24h: 0,
    m06_signals_observed: true,
    over_budget: false,
    notification_mode: 'local_only',
    sent: false,
  },
  rendered: { subject: 'Market Radar health', text: 'Unknown story gap', html: '<p>Unknown story gap</p>' },
  sent: false,
  delivery: 'local_only',
});

test('health native read accepts maintained projection/rendering without inventing unknown values or sending mail', () => {
  const s = initializeM06UpkeepHealth({ env: 'dev' }, '1000');
  const out = verifyM06UpkeepHealth(reply(s, healthResult()), s);
  assert.equal(out.projection.story_capture_gap, null);
  assert.equal(out.sent, false);
  assert.equal(out.delivery, 'local_only');
  const g = buildNativeM06Health(b, transport).workflow;
  const input = code(g, 'Prepare maintained health read', { env: 'dev' })[0].json;
  const actual = code(g, 'Verify local health delivery', reply(input, healthResult()), {
    'Prepare maintained health read': input,
  })[0].json;
  assert.equal(actual.sent, false);
  assert.equal(actual.projection.story_queue_depth, null);
  for (const patch of [{ sent: true }, { delivery: 'email' }, { raw_error: 'private' }])
    assert.throws(
      () => verifyM06UpkeepHealth(reply(s, { ...healthResult(), ...patch }), s),
      /HEALTH_RECEIPT_INVALID/,
    );
  for (const patch of [
    { story_capture_gap: 2 },
    { story_queue_depth: -1 },
    { sent: true },
    { raw_error: 'private' },
  ])
    assert.throws(
      () =>
        verifyM06UpkeepHealth(
          reply(s, { ...healthResult(), projection: { ...healthResult().projection, ...patch } }),
          s,
        ),
      /HEALTH_RECEIPT_INVALID/,
    );
});
