import { describe, expect, it } from 'vitest';
import { databaseFailure } from './database-failure';

describe('database boundary errors never reflect credentials or raw native errors', () => {
  it.each([
    ['SELF_SIGNED_CERT_IN_CHAIN', 'M02_DATABASE_TLS_CERTIFICATE_REJECTED', 'not_reached_tls_rejected'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'M02_DATABASE_TLS_CERTIFICATE_REJECTED', 'not_reached_tls_rejected'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'M02_DATABASE_TLS_CERTIFICATE_REJECTED', 'not_reached_tls_rejected'],
    ['28P01', 'M02_DATABASE_AUTHENTICATION_REJECTED', 'authentication_rejected'],
    ['28000', 'M02_DATABASE_AUTHORIZATION_REJECTED', 'not_established'],
    ['ENOTFOUND', 'M02_DATABASE_DNS_FAILED', 'not_reached_dns_failed'],
    ['CONNECT_TIMEOUT', 'M02_DATABASE_CONNECTION_TIMEOUT', 'not_established'],
    ['ECONNREFUSED', 'M02_DATABASE_CONNECTION_FAILED', 'not_established'],
  ])('classifies %s at its actual evidence boundary', (nativeCode, code, authentication) => {
    expect(
      databaseFailure({
        code: nativeCode,
        message: 'test-only-private-sentinel',
        query: 'test-only-private-sentinel',
        parameters: ['test-only-private-sentinel'],
      }),
    ).toEqual({ code, authentication, nativeCode });
  });
  it('does not inspect messages/query/parameters and redacts unknown error codes', () => {
    const error = {
      code: 'test-only-private-sentinel',
      get message(): never {
        throw new Error('must never read message');
      },
    };
    expect(databaseFailure(error)).toEqual({
      code: 'M02_DATABASE_CONNECTION_UNCLASSIFIED',
      authentication: 'not_established',
      nativeCode: 'unclassified',
    });
    expect(JSON.stringify(databaseFailure(error))).not.toContain('test-only-private-sentinel');
  });
  it.each([null, undefined, 'test-only-private-sentinel', { code: 42 }])(
    'handles non-native failures without reflecting them',
    (error) => {
      expect(databaseFailure(error).nativeCode).toBe('unclassified');
    },
  );
});
