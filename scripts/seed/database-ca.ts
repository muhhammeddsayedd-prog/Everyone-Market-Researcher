import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SeedRuntimeError, seedTargets } from './config';

const metadataSchema = z.strictObject({
  version: z.literal(1),
  projectRef: z.literal(seedTargets.dev.ref),
  host: z.literal(seedTargets.dev.host),
  sourceUrl: z.literal(
    'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',
  ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

/** The sealed public pin establishes provenance. TLS verifies the chain and hostname. */
export function validateDevCa(bytes: Buffer, metadata: unknown): string {
  const parsed = metadataSchema.safeParse(metadata);
  if (
    !parsed.success ||
    bytes.length > 100_000 ||
    createHash('sha256').update(bytes).digest('hex') !== parsed.data.sha256
  )
    throw new SeedRuntimeError('M02_PUBLIC_CA_REJECTED');
  const pem = bytes.toString('utf8');
  if (!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+\r?\n-----END CERTIFICATE-----\s*$/.test(pem))
    throw new SeedRuntimeError('M02_PUBLIC_CA_REJECTED');
  return pem;
}
