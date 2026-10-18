import { createConnection } from 'node:net';
import { connect } from 'node:tls';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';

const host = 'aws-1-eu-central-1.pooler.supabase.com';
const knownCodes = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
]);

/** Single checked-in public provenance/pin; a pending pin grants no trust. */
export function approvedCaPin(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'host,projectRef,sha256,sourceUrl,version' ||
    value.version !== 1 ||
    value.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    value.host !== host ||
    value.sourceUrl !==
      'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt' ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error('PUBLIC_CA_PIN_PENDING_OR_INVALID');
  return value;
}

/** Public protocol/TLS diagnostics only: never send a Postgres StartupMessage or authenticate. */
export function probePoolerTls({
  tcpConnect = createConnection,
  tlsConnect = connect,
  timeoutMs = 10_000,
  ca,
  onPhase = () => {},
  cleanupTimeoutMs = 1_000,
} = {}) {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 10_000 ||
    !Number.isInteger(cleanupTimeoutMs) ||
    cleanupTimeoutMs < 1 ||
    cleanupTimeoutMs > 1_000
  )
    throw new Error('TLS_PROBE_BOUND_REJECTED');
  return new Promise((resolve) => {
    let phase = 'tcp_connect';
    onPhase('tcp_connect');
    let plain;
    let secure;
    let settled = false;
    const result = {
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      host,
      port: 5432,
      rejectUnauthorized: true,
      exactServerName: true,
      startupMessageSent: false,
      authenticationAttempted: false,
    };
    const finish = async (status, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onPhase('cleanup_start');
      const owner = secure ?? plain;
      const closed =
        !owner || owner.closed ? Promise.resolve() : new Promise((done) => owner.once('close', done));
      // The TLS wrapper owns the underlying TCP handle after tls.connect({socket}).
      // Destroying that live underlying handle first can crash native TLS cleanup.
      try {
        owner?.destroy();
      } catch {
        /* Bounded close confirmation below still fails closed. */
      }
      let cleanupTimer;
      const socketsClosed = await Promise.race([
        closed.then(() => true),
        new Promise((done) => {
          cleanupTimer = setTimeout(() => done(false), cleanupTimeoutMs);
        }),
      ]);
      clearTimeout(cleanupTimer);
      onPhase('cleanup_complete');
      resolve({
        ...result,
        status: socketsClosed ? status : 'failed',
        phase,
        code: socketsClosed ? code : 'TLS_CLEANUP_INCOMPLETE',
        socketsClosed,
      });
    };
    const error = (failure) => {
      const code = knownCodes.has(failure?.code)
        ? failure.code
        : phase === 'tls_handshake'
          ? 'TLS_ERROR'
          : 'NETWORK_ERROR';
      void finish('failed', code);
    };
    const timer = setTimeout(() => {
      void finish('failed', 'TIMEOUT');
    }, timeoutMs);
    try {
      plain = tcpConnect({ host, port: 5432, family: 4 });
      plain.on('error', error);
      plain.on('close', () => {
        void finish('failed', 'CONNECTION_CLOSED');
      });
      plain.once('connect', () => {
        onPhase('tcp_connected');
        phase = 'ssl_request';
        plain.once('data', (bytes) => {
          onPhase('ssl_response');
          if (bytes.length !== 1 || bytes[0] !== 83) {
            void finish(
              'failed',
              bytes.length === 1 && bytes[0] === 78 ? 'SSL_NOT_SUPPORTED' : 'SSL_RESPONSE_REJECTED',
            );
            return;
          }
          phase = 'tls_handshake';
          try {
            onPhase('tls_connect');
            secure = tlsConnect({
              socket: plain,
              servername: host,
              rejectUnauthorized: true,
              minVersion: 'TLSv1.2',
              ...(ca === undefined ? {} : { ca }),
            });
            secure.on('error', error);
            secure.on('close', () => {
              void finish('failed', 'CONNECTION_CLOSED');
            });
            secure.once('secureConnect', () => {
              onPhase('tls_secure_connect');
              void finish(
                secure.authorized ? 'verified' : 'failed',
                secure.authorized ? 'TLS_VERIFIED' : 'TLS_UNAUTHORIZED',
              );
            });
          } catch (failure) {
            error(failure);
          }
        });
        const request = Buffer.alloc(8);
        request.writeUInt32BE(8, 0);
        request.writeUInt32BE(80877103, 4);
        plain.write(request);
      });
    } catch (failure) {
      error(failure);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const trace = process.argv.length === 3 && process.argv[2] === '--trace-public-phases';
  const phase = (value) => {
    if (trace)
      process.stdout.write(
        JSON.stringify({
          type: 'public_phase',
          phase: value,
          nodeVersion: process.version,
          nodeArch: process.arch,
        }) + '\n',
      );
  };
  const privateName =
    /^(?:PG.*|SUPABASE_.*|.*DATABASE_URL|N8N_WRITER_URL|API_AGENT_URL|VIMEO_TOKEN|YOUTUBE_API_KEY)$/;
  if (
    (!trace && process.argv.length !== 2) ||
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
      phase('metadata_read');
      const metadata = approvedCaPin(
        JSON.parse(readFileSync(new URL('./certs/supabase-root-2021.json', import.meta.url), 'utf8')),
      );
      phase('ca_read');
      const ca = readFileSync(new URL('./certs/supabase-root-2021.crt', import.meta.url), 'utf8');
      phase('ca_hash');
      if (ca.length > 100_000 || createHash('sha256').update(ca).digest('hex') !== metadata.sha256)
        throw new Error('CA_REJECTED');
      phase('ca_parse');
      const certificate = new X509Certificate(ca);
      phase('ca_constraints');
      if (!certificate.ca) throw new Error('CA_REJECTED');
      phase('ca_public_key');
      const publicKey = certificate.publicKey;
      phase('ca_self_signature');
      if (!certificate.verify(publicKey)) throw new Error('CA_REJECTED');
      phase('ca_validity');
      if (Date.now() < Date.parse(certificate.validFrom) || Date.now() > Date.parse(certificate.validTo))
        throw new Error('CA_REJECTED');
      phase('tls_start');
      const result = await probePoolerTls({ ca, onPhase: phase });
      process.stdout.write(
        JSON.stringify({ observedAt: new Date().toISOString(), ...result, scopedCaVerified: true }) + '\n',
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
