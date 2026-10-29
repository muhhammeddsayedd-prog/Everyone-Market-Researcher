import { z } from 'zod';

const attempt = z.strictObject({ attempt_id: z.uuid(), owner_id: z.uuid() });
const base = { version: z.literal(1), requestId: z.uuid() };
const attemptRequest = <T extends string>(operation: T) =>
  z.strictObject({ ...base, operation: z.literal(operation), args: attempt });
export const m07ExtractionRequest = z.discriminatedUnion('operation', [
  z.strictObject({
    ...base,
    operation: z.literal('claim'),
    args: z.strictObject({ owner_id: z.uuid(), limit: z.literal(1).default(1) }),
  }),
  attemptRequest('prepare'),
  attemptRequest('dispatch'),
  attemptRequest('status'),
  attemptRequest('ack'),
  attemptRequest('outcome.unknown'),
  z.strictObject({
    ...base,
    operation: z.literal('settle'),
    args: attempt.extend({ provider_response: z.unknown() }),
  }),
]);
export const m07ExtractionReceipt = z.strictObject({
  ...base,
  operation: z.enum(['claim', 'prepare', 'dispatch', 'settle', 'status', 'ack', 'outcome.unknown']),
  result: z.unknown(),
});
export type M07ExtractionRequest = z.infer<typeof m07ExtractionRequest>;
export type M07DbOperation =
  'claim' | 'prepare' | 'frozen' | 'freeze' | 'dispatch' | 'status' | 'apply' | 'fail' | 'ack';
export type M07Dispatch = (
  operation: M07DbOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;
