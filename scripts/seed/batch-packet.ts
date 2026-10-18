import { z } from 'zod';
import { SeedRuntimeError } from './config';

const limitsSchema = z.strictObject({
  competitors: z.literal(285),
  accounts: z.literal(1754),
  vimeoAccounts: z.literal(202),
  youtubeAccounts: z.literal(128),
  websiteAccounts: z.literal(460),
  remoteLogos: z.literal(267),
  uploadedBytes: z.literal(20971520),
});
const packetSchema = z.strictObject({
  version: z.literal(1),
  target: z.literal('zmotjsbzhzjvpelxvxlf'),
  approved: z.boolean(),
  approvalReference: z.string().min(1).nullable(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  baselineSvgSha256: z.string().regex(/^[a-f0-9]{64}$/),
  limits: limitsSchema,
  expectedIncrementalUsd: z.literal(0),
  paidProviderCalls: z.literal(0),
});
export function assertDevBatchPacket(
  value: unknown,
  sourceSha256: string,
  baselineSvgSha256: string,
  counts: Record<Exclude<keyof z.infer<typeof limitsSchema>, 'uploadedBytes'>, number>,
) {
  const result = packetSchema.safeParse(value);
  if (!result.success) throw new SeedRuntimeError('M02_DEV_BATCH_PACKET_INVALID');
  const packet = result.data;
  if (!packet.approved || !packet.approvalReference)
    throw new SeedRuntimeError('M02_DEV_BATCH_APPROVAL_PENDING');
  if (packet.sourceSha256 !== sourceSha256 || packet.baselineSvgSha256 !== baselineSvgSha256)
    throw new SeedRuntimeError('M02_DEV_BATCH_SOURCE_CHANGED');
  if (Object.entries(counts).some(([key, count]) => count !== packet.limits[key as keyof typeof counts]))
    throw new SeedRuntimeError('M02_DEV_BATCH_VOLUME_CHANGED');
  return packet;
}
