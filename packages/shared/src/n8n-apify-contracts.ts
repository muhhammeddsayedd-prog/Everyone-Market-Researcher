import { z } from 'zod';

// Current primary contracts, checked 2026-10-18:
// https://docs.apify.com/api/v2/actor-run-get
// https://docs.apify.com/api/v2/actors-runs-post
// This module validates/describes operations; it performs no network or SQL.
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const actorId = 'aYG0l9s7dbB7j3gbS';
const wireStatuses = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'] as const;
const sqlStatuses = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'] as const;
function read<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(code);
  return parsed.data;
}
const notificationSchema = z.object({
  eventType: z.enum(['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED']),
  resource: z.object({ id: identifier }),
});
export function callbackRunId(value: unknown): string {
  // Strip every other field, including callback-supplied EMR/status/dataset/cost.
  return read(notificationSchema, value, 'EMR_APIFY_NOTIFICATION_INVALID').resource.id;
}
const registrySchema = z.object({
  apify_run_id: identifier,
  actor_id: z.enum(['apify/website-content-crawler', actorId]),
  run_id: z.uuid(),
  account_ids: z.array(z.uuid()).length(1),
  purpose: z.literal('daily'),
  processed_at: z.iso.datetime({ offset: true }).nullable(),
});
export function registeredSmokeRun(value: unknown, expectedRunId: string) {
  if (value === null) throw new Error('EMR_APIFY_RUN_UNREGISTERED');
  const registry = read(registrySchema, value, 'EMR_APIFY_REGISTRY_INVALID');
  if (registry.apify_run_id !== expectedRunId) throw new Error('EMR_APIFY_REGISTRY_INVALID');
  // Parent environment/manual/WF99/fixture ownership/live lease are enforced by
  // the atomic SQL processor. Registry readback alone cannot establish them.
  return registry;
}
const apiRunSchema = z.object({
  data: z.object({
    id: identifier,
    actId: z.literal(actorId),
    status: z.enum(wireStatuses),
    defaultDatasetId: identifier.nullish(),
    usageTotalUsd: z.number().nonnegative().max(999999.999999),
    finishedAt: z.iso.datetime({ offset: true }),
  }),
});
const snapshotSchema = z
  .strictObject({
    apifyRunId: identifier,
    parentRunId: z.uuid(),
    accountId: z.uuid(),
    actorId: z.literal(actorId),
    wireStatus: z.enum(wireStatuses),
    status: z.enum(sqlStatuses),
    datasetId: identifier.nullable(),
    usageTotalUsd: z.number().nonnegative().max(999999.999999),
    finishedAt: z.iso.datetime({ offset: true }),
  })
  .refine((r) => r.status === (r.wireStatus === 'TIMED-OUT' ? 'TIMED_OUT' : r.wireStatus));
export type TrustedTerminalSnapshot = z.infer<typeof snapshotSchema>;
export function trustedTerminalRun(
  value: unknown,
  registry: ReturnType<typeof registeredSmokeRun>,
): TrustedTerminalSnapshot {
  const { data } = read(apiRunSchema, value, 'EMR_APIFY_TRUSTED_RUN_INVALID');
  if (data.id !== registry.apify_run_id || (data.status === 'SUCCEEDED' && !data.defaultDatasetId))
    throw new Error('EMR_APIFY_TRUSTED_RUN_INVALID');
  // The authenticated GET must supply usageTotalUsd. An anonymous hard-to-guess
  // run URL omits it; missing cost is never substituted with zero.
  return {
    apifyRunId: data.id,
    parentRunId: registry.run_id,
    accountId: registry.account_ids[0]!,
    actorId,
    wireStatus: data.status,
    status: data.status === 'TIMED-OUT' ? 'TIMED_OUT' : data.status,
    datasetId: data.defaultDatasetId ?? null,
    usageTotalUsd: data.usageTotalUsd,
    finishedAt: data.finishedAt,
  };
}
export function settledTerminalRun(
  first: unknown,
  second: unknown,
  elapsedMs: number,
): TrustedTerminalSnapshot {
  const a = read(snapshotSchema, first, 'EMR_APIFY_COST_NOT_SETTLED');
  const b = read(snapshotSchema, second, 'EMR_APIFY_COST_NOT_SETTLED');
  if (
    !Number.isSafeInteger(elapsedMs) ||
    elapsedMs < 10000 ||
    elapsedMs > 180000 ||
    (Object.keys(a) as Array<keyof TrustedTerminalSnapshot>).some((key) => a[key] !== b[key])
  )
    throw new Error('EMR_APIFY_COST_NOT_SETTLED');
  // Two delayed stable samples are the documented settling heuristic, not an
  // assertion that the provider can never adjust its financial records later.
  return b;
}

const launchPolicySchema = z
  .strictObject({
    approved: z.literal(true),
    approvalReference: z.string().trim().min(1).max(200),
    maxTotalChargeUsd: z.number().positive(),
    batchMaxUsd: z.number().positive(),
    approvedRunCount: z.literal(2),
    actorBuild: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/),
  })
  .refine((p) => p.maxTotalChargeUsd * 2 <= p.batchMaxUsd);
export function smokeLaunchDescriptor(value: unknown) {
  const policy = read(launchPolicySchema, value, 'EMR_APIFY_LAUNCH_POLICY_REQUIRED');
  const webhooks = [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
      requestUrl: 'https://muhhammedsayed.app.n8n.cloud/webhook/emr-apify-callback',
      payloadTemplate: '{"eventType": {{eventType}}, "resource": {{resource}}}',
    },
  ];
  return {
    method: 'POST' as const,
    url: 'https://api.apify.com/v2/actors/apify~website-content-crawler/runs',
    query: {
      waitForFinish: 0,
      restartOnError: false,
      memory: 1024,
      timeout: 3600,
      build: policy.actorBuild,
      maxTotalChargeUsd: policy.maxTotalChargeUsd,
      webhooks: Buffer.from(JSON.stringify(webhooks)).toString('base64'),
    },
    body: {
      startUrls: [{ url: 'https://everyone.film/about-everyone' }],
      crawlerType: 'cheerio',
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
      saveMarkdown: true,
      proxyConfiguration: { useApifyProxy: true },
    },
    automaticRetry: false,
    spendAdmissionVerified: false,
    recovery: 'reconcile the original returned run after registration; never replace an ambiguous POST',
  };
}
