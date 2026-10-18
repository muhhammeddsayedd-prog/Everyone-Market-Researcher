import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createApifyRecoveryRuntime } from './n8n-apify-recovery';
import { registeredSmokeRun, trustedTerminalRun } from './n8n-apify-contracts';

const runtime = () => createApifyRecoveryRuntime();
const parentId = '10000000-0000-4000-8000-000000000001';
const accountId = '10000000-0000-4000-8000-000000000002';
const itemId = '10000000-0000-4000-8000-000000000003';
const runId = 'SyntheticRun';
const registry = () => ({
  apify_run_id: runId,
  actor_id: 'apify/website-content-crawler',
  run_id: parentId,
  account_ids: [accountId],
  purpose: 'daily',
  processed_at: null,
});
const wire = () => ({
  data: {
    id: runId,
    actId: 'aYG0l9s7dbB7j3gbS',
    status: 'SUCCEEDED',
    defaultDatasetId: 'SyntheticDataset',
    usageTotalUsd: 0.0045,
    finishedAt: '2026-10-18T03:00:00Z',
    privateContext: 'SYNTHETIC_PRIVATE_MARKER',
  },
});
const item = () => ({
  platform: 'website_work_page',
  external_id: 'e4d69e3fb0d821183258d75248f9df24',
  actor: 'apify/website-content-crawler',
  item_type: 'project_page',
  url: 'https://everyone.film/about-everyone',
  published_at: null,
  title: 'Synthetic title',
  caption: 'Synthetic public text',
  metrics: {},
  payload: {
    url: 'https://everyone.film/about-everyone',
    markdown: 'Synthetic public text',
    metadata: { title: 'Synthetic title' },
  },
});
const terminal = () => runtime().projectTerminal(wire(), registry());
const payload = () => runtime().makeAtomicPayload(registry(), terminal(), [item()]);
const receipt = () => ({
  updated: true,
  finished_now: true,
  apify_run_id: runId,
  run_id: parentId,
  account_ids: [accountId],
  status: 'SUCCEEDED',
  dataset_id: 'SyntheticDataset',
  cost_usd: 0.0045,
  groups_sha256: 'a'.repeat(64),
  normalizer_version: 'smoke_website_stub.v1',
  cost_keys: [`apify:${runId}:${accountId}`],
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
const completed = () => ({
  ...registry(),
  processed_at: '2026-10-18T03:01:00Z',
  status: 'SUCCEEDED',
  dataset_id: 'SyntheticDataset',
  usage_usd: 0.0045,
  processing_result: receipt(),
});
const context = () => ({
  run_id: parentId,
  account_ids: [accountId],
  actor_id: 'apify/website-content-crawler',
  purpose: 'daily',
});

describe('pure M03 recovery: synthetic values, no network or SQL', () => {
  it('embeds the exact factory without URL, imports or closure dependencies', () => {
    const r = runInNewContext(
      `(${createApifyRecoveryRuntime.toString()})()`,
      { URL: undefined, require: undefined },
      { timeout: 1000 },
    );
    expect(JSON.parse(JSON.stringify(r.projectTerminal(wire(), registry())))).toEqual(terminal());
  });
  it('projects the same registered terminal identity as the existing Zod boundary', () => {
    expect(terminal()).toEqual(trustedTerminalRun(wire(), registeredSmokeRun(registry(), runId)));
    expect(JSON.stringify(terminal())).not.toContain('SYNTHETIC_PRIVATE_MARKER');
  });
  it('unknown callback is a named audit gate, with no provider or database-write action', () => {
    expect(runtime().callbackLookup(null, runId)).toEqual({
      action: 'blocked',
      reason: 'unknown_callback_audit_unavailable',
    });
  });
  it('replays a complete saved result before any HTTP or cost write', () => {
    expect(runtime().callbackLookup(completed(), runId)).toEqual({
      action: 'saved_receipt',
      receipt: { ...receipt(), updated: false, finished_now: false },
    });
    expect(runtime().savedReplay(registry(), runId)).toBeNull();
  });
  it.each([
    { account_ids: [] },
    { actor_id: 'other/actor' },
    { purpose: 'backfill' },
    { apify_run_id: 'OtherRun' },
    { processed_at: '2026-10-18T03:01:00Z', processing_result: null },
  ])('rejects wrong or incomplete registry context without echoing input %j', (change) => {
    expect(() => runtime().callbackLookup({ ...registry(), ...change }, runId)).toThrow(/^EMR_APIFY_/);
  });
  it.each([
    { id: 'OtherRun' },
    { actId: 'otherActor' },
    { status: 'TIMED_OUT' },
    { usageTotalUsd: undefined },
    { usageTotalUsd: NaN },
    { finishedAt: 'invalid' },
    { defaultDatasetId: null },
  ])('denies untrusted terminal identity %j', (change) => {
    expect(() => runtime().projectTerminal({ data: { ...wire().data, ...change } }, registry())).toThrow(
      /^EMR_APIFY_TRUSTED_RUN_INVALID$/,
    );
  });
  it('settles only an independently delayed, unchanged terminal snapshot', () => {
    expect(runtime().settle(terminal(), terminal(), 10000)).toEqual(terminal());
    for (const [change, delay] of [
      [{}, 9999],
      [{ usageTotalUsd: 0.006 }, 10000],
      [{ datasetId: 'OtherDataset' }, 10000],
      [{}, 180001],
    ] as const)
      expect(() => runtime().settle(terminal(), { ...terminal(), ...change }, delay)).toThrow(
        /^EMR_APIFY_COST_NOT_SETTLED$/,
      );
  });
  it('bounds changing cost rereads and never treats an earlier terminal charge as final', () => {
    let state = runtime().beginSettlement(wire(), registry(), 1000);
    expect(() => runtime().advanceSettlement(state, wire(), 10999)).toThrow(/^EMR_APIFY_COST_NOT_SETTLED$/);
    const changed = runtime().advanceSettlement(
      state,
      { data: { ...wire().data, usageTotalUsd: 0.005 } },
      11000,
    );
    expect(changed.action).toBe('wait');
    if (changed.action !== 'wait') throw Error('test setup');
    state = changed.state;
    const settled = runtime().advanceSettlement(
      state,
      { data: { ...wire().data, usageTotalUsd: 0.005 } },
      21000,
    );
    expect(settled.action).toBe('settled');
    expect(() => runtime().advanceSettlement(state, wire(), 181001)).toThrow(
      /^EMR_APIFY_SETTLEMENT_EXHAUSTED$/,
    );
  });
  it('cost changes have a finite read ceiling and identity changes fail closed', () => {
    let state = runtime().beginSettlement(wire(), registry(), 0);
    for (let i = 1; i < 4; i++) {
      const next = runtime().advanceSettlement(
        state,
        { data: { ...wire().data, usageTotalUsd: 0.005 + i / 1000 } },
        i * 10000,
      );
      if (next.action !== 'wait') throw Error('test setup');
      state = next.state;
    }
    expect(() => runtime().advanceSettlement(state, wire(), 40000)).toThrow(
      /^EMR_APIFY_SETTLEMENT_EXHAUSTED$/,
    );
    expect(() =>
      runtime().advanceSettlement(
        runtime().beginSettlement(wire(), registry(), 0),
        { data: { ...wire().data, defaultDatasetId: 'OtherDataset' } },
        10000,
      ),
    ).toThrow(/^EMR_APIFY_SETTLEMENT_IDENTITY_CHANGED$/);
  });
  it('makes exactly one trusted group for the atomic RPC, retaining no raw dataset contexts', () => {
    const p = payload();
    expect(p.p_groups).toEqual([
      { account_id: accountId, normalizer_version: 'smoke_website_stub.v1', items: [item()] },
    ]);
    expect(Object.keys(p).sort()).toEqual([
      'p_apify_run_id',
      'p_dataset_id',
      'p_groups',
      'p_status',
      'p_usage_usd',
    ]);
  });
  it.each([
    { url: 'https://everyone.film/about-everyone?token=synthetic' },
    { external_id: 'wrong' },
    { metrics: { views: 1 } },
    { published_at: '2026-10-18T03:00:00Z' },
    { payload: { ...item().payload, request: { headers: { authorization: 'SYNTHETIC_PRIVATE_MARKER' } } } },
    { caption: 'other' },
    { title: 'x'.repeat(2001) },
    { title: 'bad\ud800' },
  ])('rejects unsupported normalized item before persistence %j', (change) => {
    expect(() => runtime().makeAtomicPayload(registry(), terminal(), [{ ...item(), ...change }])).toThrow(
      /^EMR_APIFY_GROUP_INVALID$/,
    );
  });
  it('rejects overflow rather than truncating a dataset and requires one item on success', () => {
    for (const items of [[], [item(), item()]])
      expect(() => runtime().makeAtomicPayload(registry(), terminal(), items)).toThrow(
        /^EMR_APIFY_GROUP_INVALID$/,
      );
    const failed = runtime().projectTerminal(
      { data: { ...wire().data, status: 'FAILED', defaultDatasetId: null } },
      registry(),
    );
    expect(runtime().makeAtomicPayload(registry(), failed, []).p_groups[0]!.items).toEqual([]);
    expect(() => runtime().makeAtomicPayload(registry(), failed, [item()])).toThrow(
      /^EMR_APIFY_GROUP_INVALID$/,
    );
  });
  it.each([
    { cost_keys: ['forged'] },
    { items_new: 2 },
    { new_item_ids: [] },
    { account_ids: [parentId] },
    { groups_sha256: 'not-a-digest' },
    { normalizer_version: 'other' },
    { run_summary: { ...receipt().run_summary, cost_usd: 100 } },
    { finished_now: false },
    { run_id: accountId },
    { dataset_id: 'OtherDataset' },
  ])('does not accept a malformed or cross-bound atomic receipt %j', (change) => {
    expect(() => runtime().validateReceipt({ ...receipt(), ...change }, registry(), payload())).toThrow(
      /^EMR_APIFY_RECEIPT_INVALID$/,
    );
  });
  it('compares fresh receipt with durable readback before dispatch and never emits a second finish SQL call', () => {
    expect(runtime().reconcileAtomic(completed(), payload(), receipt())).toEqual({
      action: 'complete',
      receipt: receipt(),
      dispatchEligible: true,
      payloadEqualityVerified: true,
    });
    expect(runtime().reconcileAtomic(completed(), payload())).toEqual({
      action: 'complete',
      receipt: { ...receipt(), updated: false, finished_now: false },
      dispatchEligible: false,
      payloadEqualityVerified: false,
    });
    const changed = { ...completed(), processing_result: { ...receipt(), groups_sha256: 'b'.repeat(64) } };
    expect(() => runtime().reconcileAtomic(changed, payload(), receipt())).toThrow(
      /^EMR_APIFY_RECEIPT_CHANGED$/,
    );
  });
  it('reconciles ambiguous atomic writes by readback; only proven unprocessed state permits the same idempotent args', () => {
    expect(runtime().reconcileAtomic(registry(), payload())).toEqual({
      action: 'retry_same_atomic',
      payload: payload(),
      automaticRetry: false,
    });
    expect(() => runtime().reconcileAtomic(null, payload())).toThrow(/^EMR_APIFY_REGISTRY_INVALID$/);
    expect(() => runtime().reconcileAtomic(registry(), payload(), receipt())).toThrow(
      /^EMR_APIFY_RECEIPT_NOT_DURABLE$/,
    );
  });
  it('requires zero pending and a complete durable receipt, with replay delivery suppressed', () => {
    expect(runtime().pendingFinish(0, receipt())).toEqual({
      action: 'downstream_eligible',
      run_id: parentId,
      new_item_ids: [itemId],
      externalDeliveryExactlyOnce: false,
    });
    expect(runtime().pendingFinish(1, receipt())).toEqual({ action: 'wait_pending' });
    expect(runtime().pendingFinish(0, { ...receipt(), updated: false, finished_now: false })).toEqual({
      action: 'duplicate_no_dispatch',
    });
    for (const pending of [-1, 0.5, '0', null])
      expect(() => runtime().pendingFinish(pending, receipt())).toThrow(/^EMR_APIFY_PENDING_INVALID$/);
  });
  it('never replaces an ambiguous actor POST and recovers registration using only the original returned run', () => {
    expect(runtime().registrationRecovery(null, context(), null)).toEqual({
      action: 'blocked',
      reason: 'ambiguous_actor_launch_no_retry',
    });
    expect(runtime().registrationRecovery(runId, context(), null)).toEqual({
      action: 'register_same_original',
      params: [runId, 'apify/website-content-crawler', parentId, [accountId], 'daily'],
      automaticRetry: false,
    });
    expect(runtime().registrationRecovery(runId, context(), registry())).toEqual({
      action: 'process_registered',
      apify_run_id: runId,
      source: 'collector_recovery',
    });
    expect(() =>
      runtime().registrationRecovery(runId, context(), { ...registry(), run_id: accountId }),
    ).toThrow(/^EMR_APIFY_REGISTRATION_CHANGED$/);
  });
  it('handles the callback-before-register race without reusing forged callback metadata', () => {
    expect(runtime().callbackLookup(null, runId).action).toBe('blocked');
    expect(runtime().registrationRecovery(runId, context(), registry()).action).toBe('process_registered');
    expect(runtime().callbackLookup(registry(), runId)).toEqual({
      action: 'read_authenticated_run',
      apify_run_id: runId,
      url: `https://api.apify.com/v2/actor-runs/${runId}?waitForFinish=0`,
      automaticRetry: false,
    });
  });
  it('does not prepare writes from a processed registry or retry cross-account ambiguous args', () => {
    expect(() => runtime().makeAtomicPayload(completed(), terminal(), [item()])).toThrow(
      /^EMR_APIFY_REGISTRY_INVALID$/,
    );
    const changed = { ...payload(), p_groups: [{ ...payload().p_groups[0], account_id: parentId }] };
    expect(() => runtime().reconcileAtomic(registry(), changed)).toThrow(/^EMR_APIFY_REGISTRY_INVALID$/);
  });
  it.each(['2026-02-30T03:00:00Z', '2026-10-18T24:00:00Z'])(
    'rejects non-existent ISO time %s like the Zod contract',
    (finishedAt) => {
      const body = { data: { ...wire().data, finishedAt } };
      expect(() => trustedTerminalRun(body, registeredSmokeRun(registry(), runId))).toThrow();
      expect(() => runtime().projectTerminal(body, registry())).toThrow(/^EMR_APIFY_TRUSTED_RUN_INVALID$/);
    },
  );
  it('denies JSONB-incompatible NUL text before an atomic database request', () => {
    expect(() =>
      runtime().makeAtomicPayload(registry(), terminal(), [
        { ...item(), title: '\u0000', payload: { ...item().payload, metadata: { title: '\u0000' } } },
      ]),
    ).toThrow(/^EMR_APIFY_GROUP_INVALID$/);
  });
  it('validates snapshot identity even if a settlement state is locally corrupted', () => {
    const state = runtime().beginSettlement(wire(), registry(), 0);
    expect(() =>
      runtime().advanceSettlement(
        { ...state, first: { ...state.first, accountId: parentId } },
        wire(),
        10000,
      ),
    ).toThrow(/^EMR_APIFY_SETTLEMENT_IDENTITY_CHANGED$/);
  });
  it('does not acknowledge a processed registry whose stored receipt is a response-only replay', () => {
    expect(() =>
      runtime().savedReplay(
        { ...completed(), processing_result: { ...receipt(), updated: false, finished_now: false } },
        runId,
      ),
    ).toThrow(/^EMR_APIFY_RECEIPT_INVALID$/);
  });
  it('does not confuse a missing registration response with a successful readback', () => {
    expect(() => runtime().registrationRecovery(runId, context(), undefined)).toThrow(
      /^EMR_APIFY_REGISTRY_INVALID$/,
    );
  });
  it('matches PostgreSQL numeric(12,6) positive half rounding without binary toFixed drift', () => {
    const t = runtime().projectTerminal({ data: { ...wire().data, usageTotalUsd: 0.0045005 } }, registry());
    const p = runtime().makeAtomicPayload(registry(), t, [item()]);
    const r = {
      ...receipt(),
      cost_usd: 0.004501,
      run_summary: { ...receipt().run_summary, cost_usd: 0.004501 },
    };
    expect(runtime().validateReceipt(r, registry(), p)).toEqual(r);
  });
  it('accepts the actual failed-terminal atomic receipt without invented dataset rows or a success summary', () => {
    const t = runtime().projectTerminal(
      { data: { ...wire().data, status: 'TIMED-OUT', defaultDatasetId: null } },
      registry(),
    );
    const p = runtime().makeAtomicPayload(registry(), t, []);
    const r = {
      ...receipt(),
      status: 'TIMED_OUT',
      dataset_id: null,
      items_seen: 0,
      items_new: 0,
      new_item_ids: [],
      accounts_ok: 0,
      accounts_failed: 1,
      run_summary: {
        ...receipt().run_summary,
        status: 'partial',
        items_seen: 0,
        items_new: 0,
        accounts_ok: 0,
        accounts_failed: 1,
      },
    };
    expect(runtime().validateReceipt(r, registry(), p)).toEqual(r);
  });
  it('compares database JSON receipts independently of object property order', () => {
    const reordered = {
      ...receipt(),
      run_summary: Object.fromEntries(Object.entries(receipt().run_summary).reverse()),
    };
    const saved = {
      ...completed(),
      processing_result: Object.fromEntries(Object.entries(reordered).reverse()),
    };
    expect(runtime().reconcileAtomic(saved, payload(), receipt()).action).toBe('complete');
  });
  it('does not claim exact attempted payload equality from saved-only reconciliation', () => {
    const p = payload();
    p.p_groups[0].items[0]!.title = 'Different attempted public title';
    p.p_groups[0].items[0]!.payload.metadata.title = 'Different attempted public title';
    const recovered = runtime().reconcileAtomic(completed(), p);
    expect(recovered).toMatchObject({
      action: 'complete',
      dispatchEligible: false,
      payloadEqualityVerified: false,
    });
    expect('payload' in recovered).toBe(false);
  });
});
