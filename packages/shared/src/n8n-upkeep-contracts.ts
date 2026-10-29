import { z } from 'zod';

export const upkeepPlatform = z.enum(['vimeo', 'youtube', 'instagram', 'linkedin']);
const day = z.iso.date();
export const upkeepRequest = z.discriminatedUnion('operation', [
  z.strictObject({
    version: z.literal(1),
    requestId: z.uuid(),
    operation: z.literal('targets'),
    args: z.strictObject({ platform: upkeepPlatform, after: z.uuid().optional(), limit: z.literal(20) }),
  }),
  z.strictObject({
    version: z.literal(1),
    requestId: z.uuid(),
    operation: z.literal('account.process'),
    args: z.strictObject({ account_id: z.uuid(), platform: upkeepPlatform, since: day, metrics_since: day }),
  }),
  z.strictObject({
    version: z.literal(1),
    requestId: z.uuid(),
    operation: z.literal('request.status'),
    args: z.strictObject({ request_id: z.uuid() }),
  }),
  z.strictObject({
    version: z.literal(1),
    requestId: z.uuid(),
    operation: z.literal('health.read'),
    args: z.strictObject({}),
  }),
]);
export type UpkeepRequest = z.infer<typeof upkeepRequest>;
export const upkeepAccountResult = z
  .strictObject({
    account_id: z.uuid(),
    platform: upkeepPlatform,
    since: day,
    metrics_since: day,
    metrics_updated: z.number().int().nonnegative(),
    eligible: z.boolean(),
    reason: z.string().min(1).max(128).nullable(),
    removal: z
      .strictObject({
        removed: z.number().int().nonnegative(),
        restored: z.number().int().nonnegative(),
        skipped: z.string().max(128).nullable(),
      })
      .nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.eligible !== (r.reason === null) || r.eligible !== (r.removal !== null))
      ctx.addIssue({ code: 'custom', message: 'inconsistent receipt' });
  });
export const upkeepTarget = z.object({
  account_id: z.uuid(),
  competitor_id: z.uuid(),
  platform: upkeepPlatform,
  handle: z.string().nullable(),
  url: z.url(),
  external_id: z.string().nullable(),
  uploads_playlist_id: z.string().nullable(),
  since: day,
  metrics_since: day,
  observed_before: z.iso.datetime({ offset: true }),
  known_external_ids: z.array(z.string().min(1).max(200)).max(100000),
  source_runs: z.record(z.string(), z.unknown()).optional(),
});
export type UpkeepTarget = z.infer<typeof upkeepTarget>;
export type UpkeepOperation = 'targets' | 'apply' | 'status' | 'health' | 'quota';
export type UpkeepDispatch = (
  operation: UpkeepOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;
export const upkeepAccountIds = z.array(z.uuid()).min(1).max(1000);
export const upkeepTargets = z.array(upkeepTarget).max(5000);
export const upkeepStatus = z.object({
  state: z.enum(['missing', 'completed']),
  operation: z.string().nullable(),
  result: z.unknown(),
});
export const upkeepSourcePins = z.record(
  z.string(),
  z.strictObject({
    actor_id: z.string().regex(/^[A-Za-z0-9_-]+$/),
    build_id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  }),
);
