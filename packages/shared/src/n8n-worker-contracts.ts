import { z } from 'zod';

export const trialWindowId = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
export const trialWorkflow = 'M03-GATEWAY-ACCEPTANCE-DEV';
export const gatewayOperations = [
  'identity.read',
  'request.status',
  'run.start',
  'run.finish',
  'apify.register',
  'apify.read',
  'apify.pending',
  'apify.process',
  'cost.log',
  'settings.read',
  'prices.read',
  'error.log',
  'error.count',
  'health.read',
  'fees.accrue',
] as const;
export type GatewayOperation = (typeof gatewayOperations)[number];
const empty = z.strictObject({});
const id = z.uuid();
const args = {
  'identity.read': empty,
  'request.status': z.strictObject({ targetRequestId: id }),
  // Future business branches stay unavailable during this connection-only trial.
  'run.start': z.strictObject({
    workflow: z.literal('WF-99'),
    platform: z.literal('website'),
    mode: z.literal('manual'),
    executionId: id,
  }),
  'run.finish': z.strictObject({
    runId: id,
    status: z.enum(['completed', 'failed']),
    error: z.enum(['workflow_failed']).nullable(),
  }),
  'apify.register': z.strictObject({
    apifyRunId: z.string().regex(/^[A-Za-z0-9]{1,128}$/),
    runId: id,
    accountId: id,
    actorId: z.literal('aYG0l9s7dbB7j3gbS'),
    purpose: z.literal('daily'),
  }),
  'apify.read': z.strictObject({ apifyRunId: z.string().regex(/^[A-Za-z0-9]{1,128}$/) }),
  'apify.pending': z.strictObject({ runId: id }),
  'apify.process': z.never(),
  'cost.log': z.never(),
  'settings.read': z.strictObject({
    key: z.enum(['daily_budget_usd', 'stories_twice_daily', 'stats_daily_enabled']),
  }),
  'prices.read': empty,
  'error.log': z.strictObject({
    workflow: z.literal(trialWorkflow),
    executionId: id,
    message: z.literal('gateway_acceptance'),
    kind: z.literal('notify'),
  }),
  'error.count': z.strictObject({ workflow: z.literal(trialWorkflow), claimNotify: z.literal(false) }),
  'health.read': empty,
  'fees.accrue': z.strictObject({ day: z.iso.date() }),
} satisfies Record<GatewayOperation, z.ZodType>;
export const trialOperations: ReadonlySet<GatewayOperation> = new Set([
  'identity.read',
  'request.status',
  'settings.read',
  'prices.read',
  'error.log',
  'error.count',
  'health.read',
]);
const envelope = z.strictObject({
  version: z.literal(1),
  requestId: id,
  operation: z.enum(gatewayOperations),
  args: z.unknown(),
});
export interface GatewayRequest {
  version: 1;
  requestId: string;
  operation: GatewayOperation;
  args: Record<string, unknown>;
}
export function gatewayRequest(value: unknown): GatewayRequest {
  const parsed = envelope.safeParse(value);
  if (!parsed.success) throw new Error('invalid_request');
  const a = args[parsed.data.operation].safeParse(parsed.data.args);
  if (!a.success) throw new Error('invalid_request');
  if (
    parsed.data.operation === 'request.status' &&
    (a.data as { targetRequestId: string }).targetRequestId.toLowerCase() ===
      parsed.data.requestId.toLowerCase()
  )
    throw new Error('invalid_request');
  return { ...parsed.data, args: a.data as Record<string, unknown> };
}
export const gatewayStates = [
  'admitted',
  'completed',
  'in_flight',
  'conflict',
  'limited',
  'closed',
  'rejected',
  'reconciliation_required',
  'absent',
] as const;
export const gatewayCodes = [
  'operation_not_permitted',
  'window_closed',
  'window_expired',
  'rate_limited',
  'request_limit',
  'concurrency_limit',
  'args_conflict',
  'execution_failed',
  'reconciliation_required',
  'not_found',
] as const;
export const gatewayWindowSchema = z
  .strictObject({
    id: z.literal(trialWindowId),
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    closed: z.boolean(),
    totalAdmitted: z.number().int().min(0).max(100),
    boundAudience: z.url().nullable(),
    boundCommitSha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    boundDeploymentId: z
      .string()
      .regex(/^dpl_[A-Za-z0-9]{1,80}$/)
      .nullable(),
  })
  .refine(
    (w) =>
      (w.startsAt === null) === (w.expiresAt === null) &&
      (!w.startsAt ||
        (Date.parse(w.expiresAt!) > Date.parse(w.startsAt) &&
          Date.parse(w.expiresAt!) - Date.parse(w.startsAt) <= 1800000)),
  );
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const money = z.number().nonnegative().max(999999999);
const platform = z.enum([
  'vimeo',
  'instagram',
  'instagram_stories',
  'website',
  'website_work_page',
  'linkedin',
  'linkedin_employees',
  'youtube',
  'news',
]);
const provider = z.enum([
  'apify',
  'openai',
  'serpapi',
  'firecrawl',
  'vimeo',
  'youtube',
  'n8n',
  'supabase',
  'vercel',
  'email',
  'other',
]);
const account = z.strictObject({
  account_id: id,
  competitor: z.string().max(500),
  platform,
  handle: z.string().max(500).nullable(),
  last_error: z
    .string()
    .regex(/^[A-Za-z0-9_:-]{1,120}$/)
    .nullable(),
  consecutive_failures: count,
});
const stale = z.strictObject({
  account_id: id,
  competitor: z.string().max(500),
  platform,
  handle: z.string().max(500).nullable(),
  last_success_at: z.iso.datetime({ offset: true }).nullable(),
});
const legacyHealth = z.strictObject({
  failing_accounts: z.array(account).max(2000),
  stale_accounts: z.array(stale).max(2000),
  queues: z.strictObject({ ai_extract: count, embed: count, media: count }),
  items_new_yesterday: z.partialRecord(platform, count),
  cost_yesterday: z.strictObject({ total: money, by_provider: z.partialRecord(provider, money) }),
  budget: z.strictObject({ daily_budget_usd: money, over_budget: z.boolean() }),
  month_to_date_usd: money,
  forecast_month_usd: money,
  workflow_errors_24h: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), count),
});
// Accept the deployed legacy contract or the complete additive M06 contract.
// Partial upgrades and unknown fields fail closed; absence is not a zero metric.
const health = z.union([
  legacyHealth,
  legacyHealth.extend({
    zero_item_streaks: z.array(stale).max(2000),
    story_capture_gap: z.number().min(0).max(1).nullable(),
    media_missing_24h: count,
  }),
]);
export const gatewayIdentity = z.strictObject({
  currentUser: z.literal('n8n_writer'),
  sessionUser: z.literal('n8n_writer'),
  database: z.literal('postgres'),
  projectRef: z.literal('zmotjsbzhzjvpelxvxlf'),
  connectionCount: count,
});
const receipt = z.strictObject({
  state: z.enum(gatewayStates),
  code: z.enum(gatewayCodes).nullable(),
  result: z.unknown(),
  window: gatewayWindowSchema,
});
export type GatewayReceipt = z.infer<typeof receipt>;
const resultSchemas: Partial<Record<GatewayOperation, z.ZodType>> = {
  'identity.read': gatewayIdentity,
  'settings.read': z
    .strictObject({
      key: z.enum(['daily_budget_usd', 'stories_twice_daily', 'stats_daily_enabled']),
      value: z.union([z.boolean(), money]),
    })
    .refine((v) =>
      v.key === 'daily_budget_usd' ? typeof v.value === 'number' : typeof v.value === 'boolean',
    ),
  'prices.read': z.strictObject({
    prices: z
      .record(
        z.string().regex(/^[a-z0-9_~:/.-]{1,160}$/),
        z.strictObject({ unit: z.string().max(80), usd: money }),
      )
      .refine((v) => Object.keys(v).length <= 100),
  }),
  'health.read': health,
  'error.log': z.strictObject({ acknowledged: z.literal(true) }),
  'error.count': z.strictObject({ count }),
};
// Pure result validation shared with the separate foundation protocol. This
// grants no operation, window or credential authority to either transport.
export function gatewayBusinessResult(value: unknown, operation: GatewayOperation): boolean {
  return resultSchemas[operation]?.safeParse(value).success === true;
}
export function gatewayReceipt(value: unknown, operation: GatewayOperation): GatewayReceipt {
  const p = receipt.safeParse(value);
  if (!p.success) throw new Error('invalid_result');
  if (p.data.state === 'completed') {
    if (operation === 'request.status') {
      // Status carries only a validated original completed receipt or null; it cannot execute work.
      if (!Object.values(resultSchemas).some((schema) => schema.safeParse(p.data.result).success))
        throw new Error('invalid_result');
    } else if (!resultSchemas[operation]?.safeParse(p.data.result).success) throw new Error('invalid_result');
  } else if (p.data.result !== null) throw new Error('invalid_result');
  return p.data;
}
