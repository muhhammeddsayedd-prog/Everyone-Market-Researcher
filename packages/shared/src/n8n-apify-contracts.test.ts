import { describe, it, expect } from 'vitest';
import {
  callbackRunId,
  registeredSmokeRun,
  trustedTerminalRun,
  settledTerminalRun,
  smokeLaunchDescriptor,
} from './n8n-apify-contracts';

const runId = 'SyntheticActorRun';
const registry = () => ({
  apify_run_id: runId,
  actor_id: 'apify/website-content-crawler',
  run_id: '10000000-0000-4000-8000-000000000001',
  account_ids: ['10000000-0000-4000-8000-000000000002'],
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
    finishedAt: '2026-10-18T03:00:00.000Z',
    meta: { secret: 'SYNTHETIC_PRIVATE_MARKER' },
  },
});
describe('M03 Apify trusted callback boundary, synthetic input only', () => {
  it('takes only the notified run ID; callback status, dataset, account and cost are never trusted', () => {
    expect(
      callbackRunId({
        eventType: 'ACTOR.RUN.SUCCEEDED',
        resource: { id: runId, status: 'FAILED', defaultDatasetId: 'forged' },
        emr: { account_ids: ['forged'], usage_usd: 999 },
      }),
    ).toBe(runId);
    for (const value of [
      null,
      {},
      { eventType: 'ACTOR.RUN.RUNNING', resource: { id: runId } },
      { eventType: 'ACTOR.RUN.SUCCEEDED', resource: { id: '../../token?private=SYNTHETIC_PRIVATE_MARKER' } },
    ])
      expect(() => callbackRunId(value)).toThrow(/^EMR_APIFY_NOTIFICATION_INVALID$/);
  });
  it('requires the registered bounded account and approved actor before any authenticated run read', () => {
    const r = registeredSmokeRun(registry(), runId);
    expect(r.account_ids).toEqual(registry().account_ids);
    for (const change of [
      { actor_id: 'other/actor' },
      { apify_run_id: 'otherRun' },
      { purpose: 'backfill' },
      { account_ids: [] },
      { account_ids: [...registry().account_ids, ...registry().account_ids] },
    ])
      expect(() => registeredSmokeRun({ ...registry(), ...change }, runId)).toThrow(
        /^EMR_APIFY_REGISTRY_INVALID$/,
      );
    expect(() => registeredSmokeRun(null, runId)).toThrow(/^EMR_APIFY_RUN_UNREGISTERED$/);
  });
  it.each([
    ['SUCCEEDED', 'SUCCEEDED'],
    ['FAILED', 'FAILED'],
    ['TIMED-OUT', 'TIMED_OUT'],
    ['ABORTED', 'ABORTED'],
  ])('maps the documented wire terminal status %s to %s', (status, expected) => {
    const r = trustedTerminalRun({ data: { ...wire().data, status } }, registeredSmokeRun(registry(), runId));
    expect(r.status).toBe(expected);
    expect(JSON.stringify(r)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
  });
  it.each([
    { id: 'differentRun' },
    { actId: 'differentActor' },
    { status: 'RUNNING' },
    { status: 'TIMED_OUT' },
    { usageTotalUsd: undefined },
    { usageTotalUsd: -0.0000001 },
    { usageTotalUsd: NaN },
    { defaultDatasetId: null },
  ])(
    'rejects mismatched, nonterminal or unauthenticated-cost snapshots without raw field errors',
    (change) => {
      expect(() =>
        trustedTerminalRun({ data: { ...wire().data, ...change } }, registeredSmokeRun(registry(), runId)),
      ).toThrow(/^EMR_APIFY_TRUSTED_RUN_INVALID$/);
    },
  );
  it('requires an independent delayed read and stable run/actor/status/dataset/cost before persistence', () => {
    const r = trustedTerminalRun(wire(), registeredSmokeRun(registry(), runId));
    expect(settledTerminalRun(r, { ...r }, 10000)).toEqual(r);
    for (const [next, delay] of [
      [r, 9999],
      [{ ...r, usageTotalUsd: 0.005 }, 10000],
      [{ ...r, datasetId: 'other' }, 10000],
      [{ ...r, status: 'FAILED' }, 10000],
    ] as const)
      expect(() => settledTerminalRun(r, next, delay)).toThrow(/^EMR_APIFY_COST_NOT_SETTLED$/);
    expect(() => settledTerminalRun(r, r, NaN)).toThrow(/^EMR_APIFY_COST_NOT_SETTLED$/);
  });
});

describe('M03 WF99 async descriptor only; no request execution or spend admission', () => {
  const policy = () => ({
    approved: true,
    approvalReference: 'Synthetic local approval only',
    maxTotalChargeUsd: 0.01,
    batchMaxUsd: 0.02,
    approvedRunCount: 2,
    actorBuild: '0.0.123',
  });
  it('requires an explicit reviewed policy and produces one bounded async no-retry POST descriptor', () => {
    const r = smokeLaunchDescriptor(policy());
    expect(r.url).toBe('https://api.apify.com/v2/actors/apify~website-content-crawler/runs');
    expect(r.method).toBe('POST');
    expect(r.query.waitForFinish).toBe(0);
    expect(r.query.restartOnError).toBe(false);
    expect(r.automaticRetry).toBe(false);
    expect(r.spendAdmissionVerified).toBe(false);
    expect(r.body).toMatchObject({
      startUrls: [{ url: 'https://everyone.film/about-everyone' }],
      maxCrawlPages: 1,
      maxCrawlDepth: 0,
      crawlerType: 'cheerio',
    });
    expect(Buffer.from(r.query.webhooks, 'base64').toString('utf8')).toContain(
      'https://muhhammedsayed.app.n8n.cloud/webhook/emr-apify-callback',
    );
    expect(JSON.stringify(r)).not.toMatch(/apiKey|Bearer|run-sync/);
  });
  it.each([
    { approved: false },
    { approvalReference: '   ' },
    { maxTotalChargeUsd: undefined },
    { maxTotalChargeUsd: 0 },
    { maxTotalChargeUsd: Infinity },
    { batchMaxUsd: 0.019 },
    { approvedRunCount: 3 },
    { actorBuild: '' },
    { token: 'SYNTHETIC_PRIVATE_MARKER' },
  ])('does not fabricate approval, caps or builds', (change) => {
    expect(() => smokeLaunchDescriptor({ ...policy(), ...change })).toThrow(
      /^EMR_APIFY_LAUNCH_POLICY_REQUIRED$/,
    );
  });
});
