import { z } from 'zod';
const base = { version: z.literal(1), requestId: z.uuid() };
const batch = z.strictObject({ batch_id: z.uuid(), owner_id: z.uuid() });
const request = <T extends string>(operation: T) =>
  z.strictObject({ ...base, operation: z.literal(operation), args: batch });
export const m07EmbeddingRequest = z.discriminatedUnion('operation', [
  z.strictObject({ ...base, operation: z.literal('claim'), args: z.strictObject({ owner_id: z.uuid() }) }),
  request('prepare'),
  request('dispatch'),
  request('status'),
  request('ack'),
  request('outcome.unknown'),
  z.strictObject({
    ...base,
    operation: z.literal('settle'),
    args: batch.extend({ provider_response: z.unknown() }),
  }),
]);
export type M07EmbeddingDbOperation =
  'claim' | 'prepare' | 'dispatch' | 'settle' | 'unknown' | 'status' | 'ack';
export type M07EmbeddingDispatch = (
  operation: M07EmbeddingDbOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;
