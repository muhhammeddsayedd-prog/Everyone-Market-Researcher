import { z } from 'zod';

export const mediaPlatforms = [
  'vimeo',
  'instagram',
  'instagram_stories',
  'website_work_page',
  'linkedin',
  'youtube',
] as const;
const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const external = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+$/)
  .refine((value) => value !== '.' && !value.includes('..'));
const identity = z.strictObject({
  competitor_slug: slug,
  platform: z.enum(mediaPlatforms),
  external_id: external,
});
export const mediaStoragePath = z
  .string()
  .min(1)
  .max(512)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*\/(vimeo|instagram|instagram_stories|website_work_page|linkedin|youtube)\/[A-Za-z0-9_.-]+\/thumb\.jpg$/,
  )
  .refine((value) => {
    const [competitor_slug, platform, external_id] = value.split('/');
    return identity.safeParse({ competitor_slug, platform, external_id }).success;
  });
export function mediaThumbnailPath(value: z.input<typeof identity>): string {
  const item = identity.parse({
    competitor_slug: value.competitor_slug,
    platform: value.platform,
    external_id: value.external_id,
  });
  return mediaStoragePath.parse(`${item.competitor_slug}/${item.platform}/${item.external_id}/thumb.jpg`);
}
export const mediaUploadRequest = z.strictObject({ path: mediaStoragePath });
export const mediaSignedUpload = z.strictObject({
  signedUrl: z.url().max(4096),
  token: z.string().min(1).max(8192),
  path: mediaStoragePath,
});
export const mediaTarget = z
  .strictObject({
    item_id: z.uuid(),
    competitor_slug: slug,
    platform: z.enum(mediaPlatforms),
    external_id: external,
    thumbnail_source_url: z.string().max(8192).nullable(),
    has_thumbnail: z.boolean(),
    thumbnail_locked: z.boolean(),
    storage_path: mediaStoragePath,
  })
  .refine((value) => value.storage_path === mediaThumbnailPath(value));
const queueId = z.union([
  z.number().int().positive().safe().transform(String),
  z
    .string()
    .regex(/^[1-9][0-9]{0,18}$/)
    .refine((value) => BigInt(value) <= 9223372036854775807n),
]);
export const mediaQueueMessage = z.strictObject({
  msg_id: queueId,
  read_ct: z.number().int().nonnegative().max(2147483647),
  message: z.strictObject({ item_id: z.uuid() }),
});
export type MediaTarget = z.infer<typeof mediaTarget>;
export type MediaQueueMessage = z.infer<typeof mediaQueueMessage>;
export type MediaSignedUpload = z.infer<typeof mediaSignedUpload>;

export const mediaExecutionId = z.string().regex(/^[1-9][0-9]{0,19}$/);
export const mediaBatchInput = z.strictObject({ execution_id: mediaExecutionId });
const batchCount = z.number().int().min(0).max(50);
export const mediaBatchSummary = z
  .strictObject({
    state: z.enum(['completed', 'partial', 'reconciliation_required']),
    claimed: batchCount,
    processed: batchCount,
    held: batchCount,
    stored: batchCount,
    skipped: batchCount,
    expired: batchCount,
    retryable: batchCount,
    reconciliation_required: batchCount,
    bytes: z
      .number()
      .int()
      .min(0)
      .max(50 * 2 * 1024 * 1024),
    infrastructure_cost_usd: z.null(),
  })
  .refine(
    (v) =>
      v.processed + v.held <= v.claimed &&
      v.stored + v.skipped + v.expired + v.retryable + v.reconciliation_required === v.processed &&
      (v.state !== 'completed' ||
        (v.held === 0 &&
          v.retryable === 0 &&
          v.reconciliation_required === 0 &&
          (v.claimed === 0 || v.processed > 0))),
  );
export const mediaBatchReceipt = mediaBatchSummary.safeExtend({
  version: z.literal(1),
  execution_id: mediaExecutionId,
  replayed: z.boolean(),
});
export type MediaBatchSummary = z.infer<typeof mediaBatchSummary>;
