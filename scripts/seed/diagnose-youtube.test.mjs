import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runYouTubeDiagnostic } from './diagnose-youtube.mjs';

const key = 'LOCAL_TEST_ONLY_KEY';
const channel = `UC${'a'.repeat(22)}`;
const uploads = `UU${'a'.repeat(22)}`;
const lookup = async () => [{ address: '8.8.8.8', family: 4 }];
const response = (value, status = 200) => ({ status, body: Buffer.from(JSON.stringify(value)) });
const fixture = (value, status = 200) =>
  runYouTubeDiagnostic(key, { lookup, transport: async () => response(value, status) });

test('empty object remains distinguishable from a proven empty result', async () => {
  const result = await fixture({});
  assert.equal(result.httpStatus, 200);
  assert.equal(result.jsonParsed, true);
  assert.equal(result.totalResults, null);
  assert.equal(result.itemCount, null);
  assert.equal(result.shape.itemsPresent, false);
});

test('explicit empty items and pageInfo zero are visible without becoming an account patch', async () => {
  const result = await fixture({ pageInfo: { totalResults: 0 }, items: [] });
  assert.equal(result.totalResults, 0);
  assert.equal(result.itemCount, 0);
  assert.equal(result.shape.itemsArray, true);
  assert.equal(result.requestCount, 1);
  assert.equal(Object.hasOwn(result, 'resolve_status'), false);
});

test('reports valid channel/uploads shape without returning their values', async () => {
  const result = await fixture({
    pageInfo: { totalResults: 1 },
    items: [{ id: channel, contentDetails: { relatedPlaylists: { uploads } } }],
  });
  assert.equal(result.shape.idMatchesCurrentPattern, true);
  assert.equal(result.shape.uploadsMatchesCurrentPattern, true);
  assert.equal(result.shape.uploadsMatchesBoundedOpaquePattern, true);
  assert.equal(JSON.stringify(result).includes(channel), false);
  assert.equal(JSON.stringify(result).includes(uploads), false);
});

test('reports missing uploads independently of a valid channel', async () => {
  const result = await fixture({ items: [{ id: channel, contentDetails: { relatedPlaylists: {} } }] });
  assert.equal(result.shape.idString, true);
  assert.equal(result.shape.uploadsPresent, false);
  assert.equal(result.shape.uploadsString, false);
});

test('reports unexpected fields as booleans and never echoes their names or contents', async () => {
  const result = await fixture({
    privateBody: key,
    items: [
      {
        id: channel,
        unknownSecret: key,
        contentDetails: { extra: key, relatedPlaylists: { uploads, secret: key } },
      },
    ],
  });
  assert.equal(result.shape.unexpectedTopLevelFields, true);
  assert.equal(result.shape.unexpectedItemFields, true);
  assert.equal(result.shape.unexpectedContentDetailsFields, true);
  assert.equal(result.shape.unexpectedRelatedPlaylistFields, true);
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.equal(JSON.stringify(result).includes('unknownSecret'), false);
});

test('multiple items stay visible as a count without selecting a successful account', async () => {
  const result = await fixture({ pageInfo: { totalResults: 2 }, items: [{ id: channel }, { id: channel }] });
  assert.equal(result.itemCount, 2);
  assert.equal(result.totalResults, 2);
});

test('a non-UU opaque uploads ID is distinguished from the current strict regex', async () => {
  const result = await fixture({
    items: [{ id: channel, contentDetails: { relatedPlaylists: { uploads: 'OTHER_safe-playlist-id_123' } } }],
  });
  assert.equal(result.shape.uploadsMatchesCurrentPattern, false);
  assert.equal(result.shape.uploadsMatchesBoundedOpaquePattern, true);
});

test('invalid JSON and non-object JSON reveal no raw body', async () => {
  const bad = await runYouTubeDiagnostic(key, {
    lookup,
    transport: async () => ({ status: 200, body: Buffer.from(key) }),
  });
  assert.equal(bad.jsonParsed, false);
  assert.equal(JSON.stringify(bad).includes(key), false);
  const scalar = await fixture(key);
  assert.equal(scalar.jsonParsed, true);
  assert.equal(scalar.shape.topLevelObject, false);
  assert.equal(JSON.stringify(scalar).includes(key), false);
});

test('exactly one call uses only the fixed endpoint, header key and bounded native options', async () => {
  let calls = 0;
  const result = await runYouTubeDiagnostic(key, {
    lookup,
    transport: async (input) => {
      calls++;
      assert.equal(input.url.origin, 'https://www.googleapis.com');
      assert.equal(input.url.pathname, '/youtube/v3/channels');
      assert.equal(input.url.searchParams.get('forHandle'), '@Gearbox-channel');
      assert.equal(input.url.searchParams.get('part'), 'id,contentDetails');
      assert.equal(
        input.url.searchParams.get('fields'),
        'pageInfo(totalResults),items(id,contentDetails/relatedPlaylists/uploads)',
      );
      assert.equal(input.url.searchParams.has('key'), false);
      assert.equal(input.headers['x-goog-api-key'], key);
      assert.equal(input.rejectUnauthorized, true);
      assert.equal(input.servername, 'www.googleapis.com');
      assert.equal(input.maxBytes, 65_536);
      assert.equal(input.signal instanceof AbortSignal, true);
      return response({}, 503);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.requestCount, 1);
  assert.equal(result.httpStatus, 503);
});

test('refuses redirects without another request or a reflected Location', async () => {
  let calls = 0;
  const result = await runYouTubeDiagnostic(key, {
    lookup,
    transport: async () => {
      calls++;
      return { ...response({ location: `https://other.example/?key=${key}` }, 302) };
    },
  });
  assert.equal(result.status, 'redirect_refused');
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes(key), false);
});

test('bounds response size and withholds raw native exceptions', async () => {
  const large = await runYouTubeDiagnostic(key, {
    lookup,
    transport: async () => ({ status: 200, body: Buffer.alloc(65_537) }),
  });
  assert.equal(large.status, 'body_too_large');
  const raw = await runYouTubeDiagnostic(key, {
    lookup,
    transport: async () => {
      throw new Error(`https://example.com/?key=${key}`);
    },
  });
  assert.equal(raw.status, 'network_failed');
  assert.equal(JSON.stringify(raw).includes(key), false);
});

test('deadline includes hanging DNS and prevents a late request', async () => {
  let calls = 0;
  const result = await runYouTubeDiagnostic(key, {
    timeoutMs: 5,
    lookup: () => new Promise(() => {}),
    transport: async () => {
      calls++;
      return response({});
    },
  });
  assert.equal(result.status, 'timeout');
  assert.equal(result.requestCount, 0);
  assert.equal(calls, 0);
});

test('deadline also bounds a hanging response and cannot exceed ten seconds', async () => {
  const result = await runYouTubeDiagnostic(key, {
    timeoutMs: 5,
    lookup,
    transport: () => new Promise(() => {}),
  });
  assert.equal(result.status, 'timeout');
  assert.equal(result.requestCount, 1);
  const invalid = await runYouTubeDiagnostic(key, {
    timeoutMs: 10_001,
    lookup,
    transport: async () => response({}),
  });
  assert.equal(invalid.status, 'invalid_options');
  assert.equal(invalid.requestCount, 0);
});

test('all DNS answers must be public and credentials are never sent before validation', async () => {
  let calls = 0;
  const result = await runYouTubeDiagnostic(key, {
    lookup: async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ],
    transport: async () => {
      calls++;
      return response({});
    },
  });
  assert.equal(result.status, 'unsafe_dns');
  assert.equal(calls, 0);
  const missing = await runYouTubeDiagnostic('', {
    lookup,
    transport: async () => {
      calls++;
      return response({});
    },
  });
  assert.equal(missing.status, 'missing_key');
  assert.equal(calls, 0);
});
