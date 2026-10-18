import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = 'www.googleapis.com';
const maxBytes = 65_536;
const shapeKeys = [
  'topLevelObject',
  'itemsPresent',
  'itemsArray',
  'pageInfoPresent',
  'pageInfoObject',
  'totalResultsPresent',
  'totalResultsNonnegativeInteger',
  'firstItemObject',
  'idPresent',
  'idString',
  'idMatchesCurrentPattern',
  'contentDetailsPresent',
  'contentDetailsObject',
  'relatedPlaylistsPresent',
  'relatedPlaylistsObject',
  'uploadsPresent',
  'uploadsString',
  'uploadsMatchesCurrentPattern',
  'uploadsMatchesBoundedOpaquePattern',
  'unexpectedTopLevelFields',
  'unexpectedItemFields',
  'unexpectedContentDetailsFields',
  'unexpectedRelatedPlaylistFields',
];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, field) => object(value) && Object.hasOwn(value, field);
const extras = (value, allowed) => object(value) && Object.keys(value).some((key) => !allowed.includes(key));

function emptyResult(status = 'completed') {
  return {
    status,
    httpStatus: null,
    jsonParsed: false,
    totalResults: null,
    itemCount: null,
    shape: Object.fromEntries(shapeKeys.map((key) => [key, false])),
    requestCount: 0,
  };
}

function inspect(result, body) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    return;
  }
  result.jsonParsed = true;
  const items = object(value) ? value.items : undefined;
  const pageInfo = object(value) ? value.pageInfo : undefined;
  const first = Array.isArray(items) ? items[0] : undefined;
  const content = object(first) ? first.contentDetails : undefined;
  const related = object(content) ? content.relatedPlaylists : undefined;
  const id = object(first) ? first.id : undefined;
  const uploads = object(related) ? related.uploads : undefined;
  const total = object(pageInfo) ? pageInfo.totalResults : undefined;
  const totalValid = Number.isSafeInteger(total) && total >= 0 && total <= 1_000_000;
  if (totalValid) result.totalResults = total;
  if (Array.isArray(items)) result.itemCount = items.length;
  Object.assign(result.shape, {
    topLevelObject: object(value),
    itemsPresent: own(value, 'items'),
    itemsArray: Array.isArray(items),
    pageInfoPresent: own(value, 'pageInfo'),
    pageInfoObject: object(pageInfo),
    totalResultsPresent: own(pageInfo, 'totalResults'),
    totalResultsNonnegativeInteger: totalValid,
    firstItemObject: object(first),
    idPresent: own(first, 'id'),
    idString: typeof id === 'string',
    idMatchesCurrentPattern: typeof id === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(id),
    contentDetailsPresent: own(first, 'contentDetails'),
    contentDetailsObject: object(content),
    relatedPlaylistsPresent: own(content, 'relatedPlaylists'),
    relatedPlaylistsObject: object(related),
    uploadsPresent: own(related, 'uploads'),
    uploadsString: typeof uploads === 'string',
    uploadsMatchesCurrentPattern: typeof uploads === 'string' && /^UU[A-Za-z0-9_-]{22}$/.test(uploads),
    uploadsMatchesBoundedOpaquePattern: typeof uploads === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uploads),
    unexpectedTopLevelFields: extras(value, ['pageInfo', 'items']),
    unexpectedItemFields: extras(first, ['id', 'contentDetails']),
    unexpectedContentDetailsFields: extras(content, ['relatedPlaylists']),
    unexpectedRelatedPlaylistFields: extras(related, ['uploads']),
  });
}

class DiagnosticError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [first = '', second = ''] = address.toLowerCase().split(':');
  const a = Number.parseInt(first, 16);
  const b = second ? Number.parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) &&
    !(a === 0x3fff && b <= 0x0fff)
  );
}

async function resolveGoogle(signal) {
  const resolver = new Resolver({ timeout: 10_000, tries: 1 });
  const cancel = () => resolver.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const entries = await Promise.all(
      [4, 6].map(async (family) => {
        try {
          const addresses = await (family === 4 ? resolver.resolve4(host) : resolver.resolve6(host));
          return addresses.map((address) => ({ address, family }));
        } catch (error) {
          if (['ENODATA', 'ENOTFOUND'].includes(error?.code)) return [];
          throw new DiagnosticError('network_failed');
        }
      }),
    );
    return entries.flat();
  } finally {
    signal.removeEventListener('abort', cancel);
    resolver.cancel();
  }
}

function nativeRequest(input) {
  return new Promise((resolveResponse, reject) => {
    const req = request(
      input.url,
      {
        method: 'GET',
        headers: input.headers,
        rejectUnauthorized: true,
        servername: host,
        agent: false,
        family: input.address.family,
        signal: input.signal,
        lookup: (_name, _options, callback) => callback(null, input.address.address, input.address.family),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          response.destroy();
          req.destroy();
          resolveResponse({ status, body: new Uint8Array() });
          return;
        }
        const advertised = Number(response.headers['content-length']);
        if (Number.isFinite(advertised) && advertised > maxBytes) {
          response.destroy();
          req.destroy();
          reject(new DiagnosticError('body_too_large'));
          return;
        }
        const chunks = [];
        let bytes = 0;
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy();
            req.destroy();
            reject(new DiagnosticError('body_too_large'));
          } else chunks.push(chunk);
        });
        response.once('end', () => resolveResponse({ status, body: Buffer.concat(chunks) }));
        response.once('error', () => reject(new DiagnosticError('network_failed')));
        response.once('aborted', () => reject(new DiagnosticError('network_failed')));
      },
    );
    req.once('error', () => reject(new DiagnosticError('network_failed')));
    req.end();
  });
}

/** Exactly one fixed public C142 lookup. Injected dependencies are local-test hooks only. */
export async function runYouTubeDiagnostic(key, dependencies = {}) {
  const result = emptyResult();
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 8192 || /[\s\0]/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let rejectOnAbort;
  const timeout = new Promise((_, reject) => {
    rejectOnAbort = () => reject(new DiagnosticError('timeout'));
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  const operation = async () => {
    const addresses = await (dependencies.lookup ?? resolveGoogle)(controller.signal);
    if (controller.signal.aborted) throw new DiagnosticError('timeout');
    if (
      !Array.isArray(addresses) ||
      !addresses.length ||
      addresses.some((entry) => entry.family !== isIP(entry.address) || !publicAddress(entry.address))
    )
      throw new DiagnosticError('unsafe_dns');
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'id,contentDetails');
    url.searchParams.set('forHandle', '@Gearbox-channel');
    url.searchParams.set(
      'fields',
      'pageInfo(totalResults),items(id,contentDetails/relatedPlaylists/uploads)',
    );
    result.requestCount = 1;
    const response = await (dependencies.transport ?? nativeRequest)({
      url,
      headers: {
        'x-goog-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-c142-diagnostic/0.1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes,
      rejectUnauthorized: true,
      servername: host,
    });
    if (controller.signal.aborted) throw new DiagnosticError('timeout');
    result.httpStatus =
      Number.isInteger(response.status) && response.status >= 100 && response.status <= 599
        ? response.status
        : null;
    if (response.status >= 300 && response.status < 400) {
      result.status = 'redirect_refused';
      return;
    }
    if (!(response.body instanceof Uint8Array)) throw new DiagnosticError('network_failed');
    if (response.body.byteLength > maxBytes) throw new DiagnosticError('body_too_large');
    inspect(result, response.body);
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    const allowed = ['timeout', 'unsafe_dns', 'body_too_large', 'network_failed'];
    result.status = controller.signal.aborted
      ? 'timeout'
      : error instanceof DiagnosticError && allowed.includes(error.code)
        ? error.code
        : 'network_failed';
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', rejectOnAbort);
    controller.abort();
  }
  return result;
}

async function cli() {
  const key = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  const result = process.argv.length > 2 ? emptyResult('argument_rejected') : await runYouTubeDiagnostic(key);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === 'completed' ? 0 : 1;
}

// Importing the module exposes pure testable functions and never starts a request.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await cli();
