import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkDns, diagnosticEnvironment } from './check-dns.mjs';

const host = 'muhhammedsayed.app.n8n.cloud';

test('uses the fixed host and inventory resolver options for both families plus one OS comparison', async () => {
  const calls = [];
  class Resolver {
    constructor(options) {
      calls.push(['resolver', options]);
    }
    async resolve4(value) {
      calls.push(['resolve4', value]);
      return ['93.184.216.34'];
    }
    async resolve6(value) {
      calls.push(['resolve6', value]);
      return ['2606:4700:4700::1111'];
    }
    cancel() {
      calls.push(['cancel']);
    }
  }
  const result = await checkDns({
    Resolver,
    lookup: async (value, options) => {
      calls.push(['lookup', value, options]);
      return [{ address: '93.184.216.34', family: 4 }];
    },
  });
  assert.deepEqual(calls, [
    ['resolver', { timeout: 10_000, tries: 1 }],
    ['resolve4', host],
    ['resolve6', host],
    ['lookup', host, { all: true }],
    ['cancel'],
  ]);
  assert.deepEqual(result, {
    resolve4: { success: true, code: 'RESOLVED' },
    resolve6: { success: true, code: 'RESOLVED' },
    osLookup: { success: true, code: 'RESOLVED' },
  });
  assert.doesNotMatch(JSON.stringify(result), /93\.184|2606:/);
});

test('retains fixed c-ares codes separately from successful OS resolution without raw errors', async () => {
  class Resolver {
    async resolve4() {
      throw Object.assign(new Error('synthetic-private-error'), { code: 'ECONNREFUSED' });
    }
    async resolve6() {
      throw Object.assign(new Error('synthetic-private-error'), { code: 'ENOTIMP' });
    }
    cancel() {}
  }
  const result = await checkDns({ Resolver, lookup: async () => [{ address: '93.184.216.34', family: 4 }] });
  assert.deepEqual(result, {
    resolve4: { success: false, code: 'ECONNREFUSED' },
    resolve6: { success: false, code: 'ENOTIMP' },
    osLookup: { success: true, code: 'RESOLVED' },
  });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private|93\.184/);
});

test('maps unknown failures and malformed answers to fixed outcomes only', async () => {
  class Resolver {
    async resolve4() {
      throw Object.assign(new Error('synthetic-private-error'), { code: 'synthetic-private-code' });
    }
    async resolve6() {
      return [];
    }
    cancel() {}
  }
  const result = await checkDns({ Resolver, lookup: async () => null });
  assert.deepEqual(result, {
    resolve4: { success: false, code: 'UNKNOWN' },
    resolve6: { success: false, code: 'EMPTY' },
    osLookup: { success: false, code: 'INVALID_RESULT' },
  });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private/);
});

test('forwards exactly the inventory OS whitelist and no credential, proxy or Node options', () => {
  assert.deepEqual(
    diagnosticEnvironment({
      SystemRoot: 'synthetic-system',
      USERPROFILE: 'synthetic-profile',
      M03_N8N_API_KEY: 'synthetic-private',
      PGPASSWORD: 'synthetic-private',
      HTTPS_PROXY: 'synthetic-private',
      NODE_OPTIONS: 'synthetic-private',
    }),
    { SystemRoot: 'synthetic-system', USERPROFILE: 'synthetic-profile' },
  );
});
