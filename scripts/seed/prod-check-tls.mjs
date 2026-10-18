import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { probePoolerTls } from './check-tls.mjs';

export function validateProdCa(bytes, metadata) {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    Object.keys(metadata).sort().join(',') !== 'host,projectRef,sha256,sourceUrl,version' ||
    metadata.version !== 1 ||
    metadata.projectRef !== 'hkiafqrcxaafdbcvjlzv' ||
    metadata.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
    metadata.sourceUrl !==
      'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt' ||
    metadata.sha256 !== '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7' ||
    bytes.length > 100000 ||
    createHash('sha256').update(bytes).digest('hex') !== metadata.sha256
  )
    throw new Error('PUBLIC_CA_REJECTED');
  const ca = bytes.toString('utf8');
  const certificate = new X509Certificate(ca);
  if (
    !certificate.ca ||
    !certificate.verify(certificate.publicKey) ||
    Date.now() < Date.parse(certificate.validFrom) ||
    Date.now() > Date.parse(certificate.validTo)
  )
    throw new Error('PUBLIC_CA_REJECTED');
  return ca;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const privateName =
    /^(?:PG.*|SUPABASE_.*|.*DATABASE_URL|N8N_WRITER_URL|API_AGENT_URL|VIMEO_TOKEN|YOUTUBE_API_KEY)$/;
  if (
    process.argv.length !== 2 ||
    Object.keys(process.env).some((name) => privateName.test(name) && process.env[name])
  ) {
    process.stdout.write(
      JSON.stringify({
        status: 'blocked',
        code: 'TLS_PROBE_REQUIRES_CREDENTIAL_FREE_PROCESS',
        authenticationAttempted: false,
      }) + '\n',
    );
    process.exitCode = 2;
  } else {
    try {
      const ca = validateProdCa(
        readFileSync(new URL('./certs/supabase-root-2021.crt', import.meta.url)),
        JSON.parse(readFileSync(new URL('./prod-ca.json', import.meta.url), 'utf8')),
      );
      const result = await probePoolerTls({ ca });
      process.stdout.write(
        JSON.stringify({
          ...result,
          environment: 'prod',
          projectRef: 'hkiafqrcxaafdbcvjlzv',
          observedAt: new Date().toISOString(),
          scopedCaVerified: true,
        }) + '\n',
      );
      process.exitCode = result.status === 'verified' && result.socketsClosed ? 0 : 1;
    } catch {
      process.stdout.write(
        JSON.stringify({
          status: 'blocked',
          phase: 'ca_load',
          code: 'PUBLIC_CA_UNAVAILABLE_OR_INVALID',
          startupMessageSent: false,
          authenticationAttempted: false,
        }) + '\n',
      );
      process.exitCode = 2;
    }
  }
}
