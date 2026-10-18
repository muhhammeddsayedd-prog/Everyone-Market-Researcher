const tlsCodes = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** Inspect only a native code allowlist. Never read message/query/parameters/stack. */
export function databaseFailure(error: unknown): {
  code: string;
  authentication: string;
  nativeCode: string;
} {
  const value = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const nativeCode = typeof value === 'string' ? value : '';
  if (tlsCodes.has(nativeCode))
    return {
      code: 'M02_DATABASE_TLS_CERTIFICATE_REJECTED',
      authentication: 'not_reached_tls_rejected',
      nativeCode,
    };
  if (nativeCode === '28P01')
    return {
      code: 'M02_DATABASE_AUTHENTICATION_REJECTED',
      authentication: 'authentication_rejected',
      nativeCode,
    };
  if (nativeCode === '28000')
    return { code: 'M02_DATABASE_AUTHORIZATION_REJECTED', authentication: 'not_established', nativeCode };
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(nativeCode))
    return { code: 'M02_DATABASE_DNS_FAILED', authentication: 'not_reached_dns_failed', nativeCode };
  if (['CONNECT_TIMEOUT', 'ETIMEDOUT'].includes(nativeCode))
    return { code: 'M02_DATABASE_CONNECTION_TIMEOUT', authentication: 'not_established', nativeCode };
  if (['ECONNREFUSED', 'ECONNRESET', 'CONNECTION_CLOSED'].includes(nativeCode))
    return { code: 'M02_DATABASE_CONNECTION_FAILED', authentication: 'not_established', nativeCode };
  return {
    code: 'M02_DATABASE_CONNECTION_UNCLASSIFIED',
    authentication: 'not_established',
    nativeCode: 'unclassified',
  };
}
