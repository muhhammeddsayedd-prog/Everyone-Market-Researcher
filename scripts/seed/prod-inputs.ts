import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { z } from 'zod';
import { seedSourceFiles, sha256, readOptionalJson } from './files';
import { loadSeedInput, planSeed } from './seed-competitors';
import { assertProdLogos, assertProdPacket, assertProdPayload, prodTarget } from './prod-model';
import { SeedRuntimeError } from './config';

const caSchema = z.strictObject({
  version: z.literal(1),
  projectRef: z.literal(prodTarget.ref),
  host: z.literal(prodTarget.host),
  sourceUrl: z.literal(
    'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',
  ),
  sha256: z.literal('700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'),
});
export async function assertNoProdRunState(out: string) {
  for (const path of [
    'prod-seed-admission.json',
    'prod-write-pending.json',
    'prod-seed-manifest.json',
    'prod-logo-manifest.json',
  ])
    if ((await readOptionalJson(join(out, path))) !== undefined)
      throw new SeedRuntimeError('M02_PROD_RECONCILIATION_REQUIRED');
}
export async function loadProdInputs(root: string, requireApproval: boolean) {
  try {
    const sources = await seedSourceFiles(root);
    const plan = planSeed(loadSeedInput(sources));
    const [packetBytes, payloadBytes, logoBytes, baseline, caBytes, metadata] = await Promise.all(
      [
        'scripts/seed/prod-seed-packet.json',
        'scripts/seed/prod-payload.json',
        'scripts/seed/prod-logo-manifest.json',
        'assets/brand/everyone-logotype.svg',
        'scripts/seed/certs/supabase-root-2021.crt',
        'scripts/seed/prod-ca.json',
      ].map((path) => readFile(join(root, path))),
    );
    const packet = assertProdPacket(
      JSON.parse(packetBytes!.toString()),
      {
        source: sources.sourceSha256,
        payload: sha256(payloadBytes!),
        logos: sha256(logoBytes!),
        baseline: sha256(baseline!),
      },
      requireApproval,
    );
    const payload = assertProdPayload(JSON.parse(payloadBytes!.toString()), plan, sources.sourceSha256);
    const logos = assertProdLogos(JSON.parse(logoBytes!.toString()), plan);
    const caMetadata = caSchema.parse(JSON.parse(metadata!.toString()));
    if (sha256(caBytes!) !== caMetadata.sha256 || caBytes!.byteLength > 100000) throw new Error();
    const certificate = new X509Certificate(caBytes!);
    if (
      !certificate.ca ||
      !certificate.verify(certificate.publicKey) ||
      Date.now() < Date.parse(certificate.validFrom) ||
      Date.now() > Date.parse(certificate.validTo)
    )
      throw new Error();
    const baselineLogo = logos.logos.find((row) => row.company_code === 'C000');
    if (baselineLogo?.sha256 !== sha256(baseline!)) throw new Error();
    return { sources, plan, packet, payload, logos, ca: caBytes!.toString('utf8') };
  } catch (error) {
    if (error instanceof SeedRuntimeError) throw error;
    throw new SeedRuntimeError('M02_PROD_LOCAL_INPUTS_REJECTED');
  }
}
